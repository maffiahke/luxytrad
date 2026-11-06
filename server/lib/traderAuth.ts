import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "./http";
import { prisma } from "./prisma";

/**
 * Trader-side authentication. Separate from the admin tokens in ./auth.ts: a trader
 * token is signed with the same secret but carries `kind: "trader"`, so an admin
 * bearer can never be replayed against the trader API (and vice-versa).
 */

export interface TraderToken {
  sub: string; // User id
  kind: "trader";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      trader?: TraderToken;
    }
  }
}

function jwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET must be set in production");
    return "luxytrades-dev-jwt-secret";
  }
  return s;
}

export function signTraderToken(userId: string): string {
  const payload: TraderToken = { sub: userId, kind: "trader" };
  return jwt.sign(payload, jwtSecret(), { expiresIn: "30d", algorithm: "HS256" });
}

/** Rejects missing/invalid trader tokens; populates req.trader otherwise. */
export function authenticateTrader(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return next(new ApiError(401, "Authentication required"));
  try {
    const payload = jwt.verify(token, jwtSecret(), { algorithms: ["HS256"] }) as jwt.JwtPayload;
    if (payload.kind !== "trader" || !payload.sub) {
      return next(new ApiError(401, "Invalid token"));
    }
    const id = String(payload.sub);
    // Reject if the account was suspended/banned since the token was issued.
    prisma.user
      .findUnique({ where: { id }, select: { status: true } })
      .then((u) => {
        if (!u) return next(new ApiError(401, "Account not found"));
        if (u.status !== "ACTIVE") return next(new ApiError(403, "Account is not active"));
        req.trader = { sub: id, kind: "trader" };
        next();
      })
      .catch(next);
  } catch {
    next(new ApiError(401, "Invalid or expired token"));
  }
}

/**
 * Non-throwing bearer lookup for routes that ALSO accept another identity
 * source (e.g. the Android messages poller falls back to ?username=). Returns
 * the trader id when the header carries a valid `kind: "trader"` token, null
 * when the header is absent, or throws 401 when the header is present but bad.
 */
export function traderIdFromHeader(req: Request): string | null {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    const payload = jwt.verify(token, jwtSecret(), { algorithms: ["HS256"] }) as jwt.JwtPayload;
    if (payload.kind === "trader" && payload.sub) return String(payload.sub);
    throw new Error("wrong kind");
  } catch (err) {
    if (token) throw new ApiError(401, "Invalid or expired token");
    return null;
  }
}
