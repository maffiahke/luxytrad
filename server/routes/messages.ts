import { Router, type Request } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError, handler } from "../lib/http";
import { traderIdFromHeader } from "../lib/traderAuth";

/**
 * The message feed the Android "Messages" app polls (the WebView injects a
 * fetch against GET /api/messages every few seconds and matches by `id` to
 * fire native notifications). Public because the WebView shell cannot replay
 * bearer tokens on its own: identity resolves in two ways:
 *   1. a normal `kind: "trader"` bearer header (the web path), else
 *   2. the ?username= fallback, resolved EXACTLY like the login route
 *      (username → phone digits → email), which is the identifier the app
 *      pins via AndroidMessagesBridge.setAppUser / messagesAppUsername.
 */
export const messagesRouter = Router();

/** Same digits-only normalisation the trader auth routes use for phone numbers. */
const digitsOf = (s: string): string => (s ?? "").replace(/\D/g, "");

export interface FeedMessage {
  id: string;
  title: string;
  body: string;
  read: boolean;
  at: string;
}

function serialize(row: { id: string; title: string; body: string; read: boolean; createdAt: Date }): FeedMessage {
  return {
    id: row.id,
    title: row.title || "MPESA",
    body: row.body,
    read: row.read,
    at: row.createdAt.toISOString(),
  };
}

/** Same dual identity resolution the GET feed uses (bearer, else ?username=). */
async function resolveFeedUser(req: Request) {
  const bearerId = traderIdFromHeader(req);
  let user = bearerId ? await prisma.user.findUnique({ where: { id: bearerId } }) : null;

  if (!user) {
    const identifier = String(req.query.username ?? "").trim();
    if (!identifier) throw new ApiError(401, "Authentication required");
    user =
      (await prisma.user.findUnique({ where: { username: identifier.toLowerCase() } })) ??
      (await prisma.user.findUnique({ where: { phone: digitsOf(identifier) } })) ??
      (await prisma.user.findFirst({ where: { email: identifier.toLowerCase() } }));
  }
  if (!user) throw new ApiError(404, "Account not found");
  if (user.status !== "ACTIVE") throw new ApiError(403, "Account is not active");
  return user;
}

messagesRouter.get(
  "/",
  handler(async (req, res) => {
    const user = await resolveFeedUser(req);

    // Newest first; the app only needs the recent window to diff new ids.
    const rows = await prisma.message.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ messages: rows.map(serialize) });
  }),
);

/**
 * Mark messages read (the /messages inbox "Mark all as read" action, or an
 * entire conversation after its thread is opened). Once read, messages no
 * longer raise native notifications — which is exactly what the user wants
 * after the inbox shows them. An optional { title } scopes the update to one
 * conversation (senders are keyed by their display title, e.g. "MPESA").
 */
const readScope = z.object({ title: z.string().trim().min(1).max(64).optional() });

messagesRouter.post(
  "/read",
  handler(async (req, res) => {
    const user = await resolveFeedUser(req);
    const { title } = readScope.catch({}).parse(req.body ?? {});
    const result = await prisma.message.updateMany({
      where: { userId: user.id, read: false, ...(title ? { title } : {}) },
      data: { read: true },
    });
    res.json({ ok: true, marked: result.count });
  }),
);

/**
 * Register an FCM device token for instant payout push. Called by the Android
 * app right after it links an account (and on Firebase token rotation).
 * Identity resolves exactly like the feed itself (bearer, else payload
 * identifier), so the token is always bound to a paying/user-visible row.
 * Upsert by token: reinstall-safe, idempotent.
 */
const deviceSchema = z.object({
  identifier: z.string().trim().min(3).max(120),
  token: z.string().trim().min(20).max(500),
});

messagesRouter.post(
  "/devices",
  handler(async (req, res) => {
    const body = deviceSchema.parse(req.body ?? {});

    // Bearer auth first (the web path), else resolve the payload identifier
    // exactly like the feed + login routes: username → phone digits → email.
    const bearerId = traderIdFromHeader(req);
    let user = bearerId ? await prisma.user.findUnique({ where: { id: bearerId } }) : null;

    if (!user) {
      const identifier = body.identifier;
      user =
        (await prisma.user.findUnique({ where: { username: identifier.toLowerCase() } })) ??
        (await prisma.user.findUnique({ where: { phone: digitsOf(identifier) } })) ??
        (await prisma.user.findFirst({ where: { email: identifier.toLowerCase() } }));
    }

    if (!user || user.status !== "ACTIVE") throw new ApiError(404, "Account not found");

    // Upsert by token: reinstall-safe and idempotent, relocating the device
    // to the current account on every registration.
    await prisma.pushToken.upsert({
      where: { token: body.token },
      create: { token: body.token, userId: user.id },
      update: { userId: user.id },
    });
    res.json({ ok: true });
  }),
);

/**
 * Diagnostics for the push leg (safe to expose: counts only, never tokens or
 * credentials). Tells the app/release whether instant delivery is configured.
 */
messagesRouter.get(
  "/push-status",
  handler(async (_req, res) => {
    let configured = false;
    try {
      const { isPushConfigured } = await import("../lib/push");
      configured = isPushConfigured();
    } catch {
      configured = false;
    }
    res.json({
      configured,
      devices: await prisma.pushToken.count(),
    });
  }),
);
