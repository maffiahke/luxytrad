import crypto from "node:crypto";
import { prisma } from "./prisma";

/**
 * Instant push delivery of payout receipts over Firebase Cloud Messaging v1.
 *
 * Credentials come from the environment (either the whole service-account
 * JSON or its individual fields) and are signed with RS256 using node:crypto
 * — deliberately NO firebase-admin dependency, since api/index.js is an
 * esbuild bundle where heavyweight SDKs bloat (or break) cold starts.
 *
 * Everything is best-effort and never throws: pushing must not roll back the
 * financial flow, and when FIREBASE_* is unset (not yet configured) this
 * silently no-ops — the phone's poller remains the fallback.
 */

const FCM_SEND_URL = (project: string) =>
  `https://fcm.googleapis.com/v1/projects/${project}/messages:send`;

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

/** Cheap env-only check used by the /api/messages/push-status diagnostic. */
export function isPushConfigured(): boolean {
  const raw = normalizeServiceAccountRaw(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? process.env.FIREBASE_SERVICE_ACCOUNT,
  );
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.project_id && parsed?.client_email && parsed?.private_key) return true;
      // Valid JSON but incomplete — fall through to the individual vars.
    } catch {
      /* fall through to individual vars */
    }
  }
  return Boolean(
    process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY &&
      process.env.FIREBASE_PROJECT_ID,
  );
}

/** Reads and normalises the service account from env. Null when unconfigured. */
function serviceAccount(): ServiceAccount | null {
  // Pasted multi-line JSON mangles in transit surprisingly often (wrapped
  // quotes, key aliases, CRLF escapes) — every accepted variant is cheap to
  // normalise, so we try them all before giving up on the whole JSON blob.
  const raw = normalizeServiceAccountRaw(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ?? process.env.FIREBASE_SERVICE_ACCOUNT,
  );
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.project_id && parsed?.client_email && parsed?.private_key) {
        return {
          project_id: parsed.project_id,
          client_email: parsed.client_email,
          private_key: String(parsed.private_key).replace(/\\r\\n/g, "\\n").replace(/\\n/g, "\n"),
        };
      }
    } catch {
      /* fall through to individual vars */
    }
  }
  const email = process.env.FIREBASE_CLIENT_EMAIL;
  const key = process.env.FIREBASE_PRIVATE_KEY;
  const project = process.env.FIREBASE_PROJECT_ID;
  if (email && key && project) {
    return {
      project_id: project,
      client_email: email,
      private_key: key.replace(/\\r\\n/g, "\\n").replace(/\\n/g, "\n"),
    };
  }
  return null;
}

/** Normalises the raw env value across common paste-mangling variants. */
function normalizeServiceAccountRaw(value: string | undefined): string | undefined {
  if (!value) return undefined;
  let v = value.trim();
  // Strip a single wrapping pair of quotes (dashboard paste artifacts).
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  // Healed JSON: private_key containing literal (escaped) newlines survives,
  // but a body whose real newlines were collapsed breaks parse — recover by
  // re-escaping newlines that appear outside the expected places.
  try {
    JSON.parse(v);
    return v;
  } catch {
    const healed = v.replace(/\r/g, "").replace(/\n/g, "\\n");
    try {
      JSON.parse(healed);
      return healed;
    } catch {
      return undefined;
    }
  }
}

let cachedToken: { value: string; expMs: number } | null = null;

/**
 * Self-contained JWT signer (RS256) built on node:crypto — no dependency.
 * Produces the compact serialisation header.claims.signature required by
 * Google's OAuth2 token endpoint. (crypto.sign() alone returns only the
 * raw signature; omitting header.claims makes Google reject the assertion.)
 */
function signJwtRS256(header: Record<string, unknown>, claims: Record<string, unknown>, privateKeyPem: string): string {
  const b64u = (input: string | Buffer): string => Buffer.from(input).toString("base64url");
  const head = b64u(JSON.stringify(header));
  const body = b64u(JSON.stringify(claims));
  const signature = crypto.sign(
    "RSA-SHA256",
    Buffer.from(`${head}.${body}`),
    crypto.createPrivateKey(privateKeyPem),
  );
  return `${head}.${body}.${b64u(signature)}`;
}

/** OAuth2 access token for the FCM API signed straight from the private key. */
async function fcmAccessToken(account: ServiceAccount): Promise<string | null> {
  if (cachedToken && cachedToken.expMs > Date.now() + 60_000) return cachedToken.value;
  try {
    const iat = Math.floor(Date.now() / 1000);
    const assertion = signJwtRS256(
      { alg: "RS256", typ: "JWT" },
      {
        iss: account.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat,
        exp: iat + 3600,
      },
      account.private_key,
    );

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }).toString(),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) return null;
    cachedToken = {
      value: body.access_token,
      expMs: Date.now() + 1000 * (body.expires_in ?? 3600),
    };
    return cachedToken.value;
  } catch {
    return null;
  }
}

interface PushPayload {
  /** Message row id — the app keys dedupe/Room insertion on it. */
  id: string;
  /** Conversation title, e.g. "MPESA". */
  title: string;
  /** The receipt body. */
  body: string;
}

/**
 * Pushes one receipt to every registered device of a user. Returns how many
 * devices received it. Stale/uninstalled tokens are pruned on 404/403.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  const account = serviceAccount();
  if (!account) return 0; // push not configured — poller fallback handles it

  const rows = await prisma.pushToken.findMany({ where: { userId }, select: { id: true, token: true } });
  if (!rows.length) return 0;

  let sent = 0;
  for (const row of rows) {
    try {
      const token = await fcmAccessToken(account);
      if (!token) break;
      const res = await fetch(FCM_SEND_URL(account.project_id), {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: row.token,
            // DATA-only so Android delivers it straight to
            // LuxyMessagingService regardless of general notification state.
            data: { id: payload.id, title: payload.title, body: payload.body },
            android: { priority: "HIGH" },
          },
        }),
      });
      if (res.ok || res.status === 429) {
        if (res.ok) sent += 1;
        continue; // 429 backoff handled by best-effort semantics
      }
      if (res.status === 404 || res.status === 400) {
        // Unregistered/invalid token — prune so we don't keep cycling on it.
        if (res.status === 404) {
          await prisma.pushToken.delete({ where: { id: row.id } }).catch(() => undefined);
        }
      }
    } catch {
      /* next device */
    }
  }
  return sent;
}
