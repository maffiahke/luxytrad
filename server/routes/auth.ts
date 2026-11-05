import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError, clientIp, handler } from "../lib/http";
import { authenticate, hashPassword, requireRole, signToken, verifyPassword } from "../lib/auth";
import { writeAudit } from "../lib/audit";
import { mapAdmin } from "../lib/serializers";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  "/auth/login",
  handler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const admin = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });
    if (!admin || !admin.active || !verifyPassword(password, admin.passwordHash)) {
      throw new ApiError(401, "Invalid credentials");
    }
    const token = signToken({ sub: admin.id, email: admin.email, name: admin.name, role: admin.role });
    await prisma.adminUser.update({ where: { id: admin.id }, data: { lastSeenAt: new Date() } });
    res.json({ email: admin.email, name: admin.name, role: admin.role, token });
  }),
);

authRouter.get(
  "/auth/me",
  authenticate,
  handler(async (req, res) => {
    const admin = await prisma.adminUser.findUnique({ where: { id: req.admin!.sub } });
    if (!admin) throw new ApiError(404, "Account not found");
    res.json(mapAdmin(admin));
  }),
);

/* ------------------------------ staff CRUD ------------------------------ */

authRouter.get(
  "/admin-users",
  authenticate,
  handler(async (_req, res) => {
    const rows = await prisma.adminUser.findMany({ orderBy: { createdAt: "asc" } });
    res.json(rows.map(mapAdmin));
  }),
);

const staffSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["SUPER_ADMIN", "OPS", "FINANCE", "SUPPORT", "READONLY"]),
  password: z.string().min(4),
});

authRouter.post(
  "/admin-users",
  authenticate,
  requireRole("SUPER_ADMIN"),
  handler(async (req, res) => {
    const data = staffSchema.parse(req.body);
    const created = await prisma.adminUser.create({
      data: { email: data.email.toLowerCase(), name: data.name, role: data.role, passwordHash: hashPassword(data.password) },
    });
    await writeAudit(req.admin, "staff_create", "AdminUser", created.id, clientIp(req));
    res.status(201).json(mapAdmin(created));
  }),
);

const staffPatch = z.object({
  role: z.enum(["SUPER_ADMIN", "OPS", "FINANCE", "SUPPORT", "READONLY"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(4).optional(),
});

authRouter.patch(
  "/admin-users/:id",
  authenticate,
  requireRole("SUPER_ADMIN"),
  handler(async (req, res) => {
    const patch = staffPatch.parse(req.body);
    const data: Record<string, unknown> = {};
    if (patch.role) data.role = patch.role;
    if (typeof patch.active === "boolean") data.active = patch.active;
    if (patch.password) data.passwordHash = hashPassword(patch.password);
    const updated = await prisma.adminUser.update({ where: { id: req.params.id }, data });
    await writeAudit(req.admin, "staff_update", "AdminUser", req.params.id, clientIp(req));
    res.json(mapAdmin(updated));
  }),
);
