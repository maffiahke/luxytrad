import crypto from "node:crypto";

/**
 * AES-256-GCM helpers for payment-gateway credentials. The 32-byte key comes from
 * GATEWAY_SECRET in the environment (base64). Encrypted blobs are stored as
 * `iv:authTag:ciphertext` (all hex) in Gateway.secretEnc and are NEVER returned raw —
 * the API only ever emits a masked preview.
 */
function key(): Buffer {
  const raw = process.env.GATEWAY_SECRET;
  if (!raw) {
    // A fixed dev fallback keeps local boot working; production must set GATEWAY_SECRET.
    if (process.env.NODE_ENV === "production") {
      throw new Error("GATEWAY_SECRET must be set in production");
    }
    return crypto.createHash("sha256").update("luxytrades-dev-gateway-secret").digest();
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    return crypto.createHash("sha256").update(raw).digest(); // derive if not already 32 bytes
  }
  return buf;
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${ct.toString("hex")}`;
}

export function decrypt(blob: string): string | null {
  try {
    const [ivHex, tagHex, ctHex] = blob.split(":");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(ctHex, "hex")), decipher.final()]).toString("utf8");
  } catch {
    return null; // wrong key / tampered blob
  }
}

/** Show only the tail of a secret, e.g. "key ••••3f9a". */
export function mask(label: string, secret: string): string {
  const tail = secret.replace(/[^a-zA-Z0-9]/g, "").slice(-4);
  return `${label} ••••${tail}`;
}

/** Constant-time signature check for inbound gateway webhooks. */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature ?? "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
