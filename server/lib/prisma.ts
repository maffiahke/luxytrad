import { PrismaClient } from "@prisma/client";

/**
 * A single PrismaClient for the whole API. In dev, tsx restarts the process so a
 * module-level singleton is fine; we also stash it on globalThis to survive any
 * future HMR and to avoid exhausting Neon's connection pool on reloads.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "production" ? ["warn", "error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
