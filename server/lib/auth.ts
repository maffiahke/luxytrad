import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { AdminRole } from "@prisma/client";
import { ApiError } from "./http";
import { prisma } from "./prisma";

export interface AdminToken {
  sub: string; // AdminUser id
  email: string;
  name: string;
  role: AdminRole;
}

// Extend Express.Request so handlers can read `req.admin` with types.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminToken;
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

export function signToken(admin: AdminToken): string {
  return jwt.sign(admin, jwtSecret(), { expiresIn: "12h", algorithm: "HS256" });
}

/** Rejects missing/invalid bearer tokens; populates req.admin otherwise. */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return next(new ApiError(401, "Authentication required"));
  try {
    const payload = jwt.verify(token, jwtSecret(), { algorithms: ["HS256"] }) as jwt.JwtPayload;
    const admin: AdminToken = {
      sub: String(payload.sub),
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as AdminRole,
    };
    // Reject if the account was disabled since the token was issued.
    prisma.adminUser
      .findUnique({ where: { id: admin.sub }, select: { active: true } })
      .then((u) => {
        if (!u || !u.active) return next(new ApiError(403, "Account disabled"));
        req.admin = admin;
        next();
      })
      .catch(next);
  } catch {
    next(new ApiError(401, "Invalid or expired token"));
  }
}

/** Role gate. Omit the list to allow any authenticated mutating role (not READONLY). */
export function requireRole(...roles: AdminRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const role = req.admin?.role;
    if (!role) return next(new ApiError(401, "Authentication required"));
    if (roles.length === 0) {
      if (role === "READONLY") return next(new ApiError(403, "Read-only account cannot modify data"));
      return next();
    }
    if (!roles.includes(role)) return next(new ApiError(403, "Insufficient permissions"));
    next();
  };
}

/** Simple password hash (scrypt, no native deps) for the seed + admin management. */
export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(pw, salt, 32);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  try {
    const [tag, saltHex, hashHex] = stored.split("$");
    if (tag !== "scrypt") return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const derived = crypto.scryptSync(pw, salt, expected.length);
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
