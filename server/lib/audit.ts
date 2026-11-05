import type { AdminToken } from "./auth";
import { prisma } from "./prisma";

/** Append an immutable audit row. Fire-and-log: never fail the business op on it. */
export async function writeAudit(
  admin: AdminToken | undefined,
  action: string,
  entity: string,
  entityId: string,
  ip?: string,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        admin: admin?.name ?? "system",
        action,
        entity,
        entityId,
        ip: ip ?? null,
      },
    });
  } catch (e) {
    console.error("[audit] write failed", e);
  }
}
