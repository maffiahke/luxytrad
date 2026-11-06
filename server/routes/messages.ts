import { Router } from "express";
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

messagesRouter.get(
  "/",
  handler(async (req, res) => {
    // 1) Bearer token (strict when present) — the normal authenticated path.
    const bearerId = traderIdFromHeader(req);
    let user = bearerId ? await prisma.user.findUnique({ where: { id: bearerId } }) : null;

    // 2) ?username= fallback from the Android poller.
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

    // Newest first; the app only needs the recent window to diff new ids.
    const rows = await prisma.message.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json({ messages: rows.map(serialize) });
  }),
);
