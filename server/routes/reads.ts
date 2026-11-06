import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ApiError, handler } from "../lib/http";
import { authenticate } from "../lib/auth";
import { decrypt, mask } from "../lib/crypto";
import { maskAddress, parseCryptoConfig } from "../lib/crypto-gateway";
import { accountReference, businessShortCode, isMpesaConfigured, loadMpesaOverridesFromDb, mpesaConfig, stkTransactionType } from "../lib/mpesa";
import {
  mapAudit,
  mapBot,
  mapCallback,
  mapDeposit,
  mapEmailLog,
  mapEmailSettings,
  mapEmailTemplate,
  mapKyc,
  mapLedger,
  mapMarket,
  mapPosition,
  mapRun,
  mapSettings,
  mapTicket,
  mapUser,
  mapWithdrawal,
} from "../lib/serializers";

export const readRouter = Router();

// Every read route below requires a valid session token.
readRouter.use(authenticate);

const userSel = { select: { fullName: true } };

readRouter.get("/users", handler(async (_req, res) => {
  const rows = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  res.json(rows.map(mapUser));
}));

readRouter.get("/deposits", handler(async (_req, res) => {
  const rows = await prisma.deposit.findMany({ orderBy: { createdAt: "desc" }, include: { user: userSel } });
  res.json(rows.map(mapDeposit));
}));

readRouter.get("/withdrawals", handler(async (_req, res) => {
  const rows = await prisma.withdrawal.findMany({ orderBy: { createdAt: "desc" }, include: { user: userSel } });
  res.json(rows.map(mapWithdrawal));
}));

readRouter.get("/positions", handler(async (_req, res) => {
  const rows = await prisma.position.findMany({ orderBy: { openedAt: "desc" }, include: { user: userSel } });
  res.json(rows.map(mapPosition));
}));

readRouter.get("/runs", handler(async (_req, res) => {
  const rows = await prisma.run.findMany({ orderBy: { id: "asc" }, include: { user: userSel } });
  res.json(rows.map(mapRun));
}));

readRouter.get("/bots", handler(async (_req, res) => {
  const rows = await prisma.bot.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  res.json(rows.map(mapBot));
}));

readRouter.get("/markets", handler(async (_req, res) => {
  const rows = await prisma.market.findMany({ orderBy: { code: "asc" } });
  res.json(rows.map(mapMarket));
}));

readRouter.get("/gateways", handler(async (_req, res) => {
  const rows = await prisma.gateway.findMany({ orderBy: { key: "asc" } });
  res.json(
    rows.map((g) => {
      const base = { key: g.key, kind: g.kind, label: g.label, enabled: g.enabled, minAmount: g.minAmount, maxAmount: g.maxAmount, feePct: g.feePct, feeFixed: g.feeFixed };
      if (g.kind.startsWith("CRYPTO_")) {
        const c = parseCryptoConfig(g.secretEnc);
        return {
          ...base,
          masked: c?.address ? maskAddress(c.address) : "not configured",
          crypto: {
            network: c?.network ?? "",
            address: c?.address ?? "",
            confirmations: c?.confirmations ?? 2,
            autoCredit: c?.autoCredit ?? false,
            callbackUrl: c?.callbackUrl ?? "",
            apiKeySet: Boolean(c?.apiKey),
          },
        };
      }
      let masked = "not configured";
      if (g.secretEnc) {
        const plain = decrypt(g.secretEnc);
        masked = plain ? mask(g.kind, plain) : "•••• (unreadable)";
      }
      return { ...base, masked };
    }),
  );
}));

readRouter.get("/gateways/mpesa/settings", handler(async (_req, res) => {
  await loadMpesaOverridesFromDb(true);
  const cfg = mpesaConfig();
  res.json({
    env: cfg.env,
    transactionType: stkTransactionType(cfg),
    businessShortCode: businessShortCode(cfg),
    accountReference: accountReference(cfg),
    shortcode: cfg.shortcode,
    tillNumber: cfg.tillNumber,
    callbackUrl: cfg.callbackUrl,
    accountRef: cfg.accountRef,
    transactionDesc: cfg.transactionDesc,
    kesRate: cfg.kesRate,
    host: cfg.host,
    configured: isMpesaConfigured(cfg),
    // Secrets are never echoed back — only whether they are set + a masked tail.
    consumerKey: { set: Boolean(cfg.consumerKey), masked: cfg.consumerKey ? mask("key", cfg.consumerKey) : "" },
    consumerSecret: { set: Boolean(cfg.consumerSecret), masked: cfg.consumerSecret ? mask("secret", cfg.consumerSecret) : "" },
    passkey: { set: Boolean(cfg.passkey), masked: cfg.passkey ? mask("passkey", cfg.passkey) : "" },
  });
}));

readRouter.get("/gateways/:key/settings", handler(async (req, res) => {
  const g = await prisma.gateway.findUnique({ where: { key: req.params.key } });
  if (!g) throw new ApiError(404, "Gateway not found");
  if (!g.kind.startsWith("CRYPTO_")) throw new ApiError(400, "Not a crypto gateway");
  const c = parseCryptoConfig(g.secretEnc);
  res.json({
    network: c?.network ?? "",
    address: c?.address ?? "",
    confirmations: c?.confirmations ?? 2,
    autoCredit: c?.autoCredit ?? false,
    callbackUrl: c?.callbackUrl ?? "",
    apiKeySet: Boolean(c?.apiKey),
    minAmount: g.minAmount,
    maxAmount: g.maxAmount,
    feePct: g.feePct,
    feeFixed: g.feeFixed,
  });
}));

readRouter.get("/gateways/callbacks", handler(async (_req, res) => {
  const rows = await prisma.gatewayCallback.findMany({ orderBy: { createdAt: "desc" } });
  res.json(rows.map(mapCallback));
}));

readRouter.get("/ledger", handler(async (_req, res) => {
  const rows = await prisma.ledgerEntry.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { user: userSel } });
  res.json(rows.map(mapLedger));
}));

readRouter.get("/kyc", handler(async (_req, res) => {
  const rows = await prisma.kycApplication.findMany({ orderBy: { submittedAt: "desc" }, include: { user: userSel } });
  res.json(rows.map(mapKyc));
}));

readRouter.get("/tickets", handler(async (_req, res) => {
  const rows = await prisma.ticket.findMany({ orderBy: { createdAt: "desc" }, include: { user: userSel, messages: { orderBy: { at: "asc" } } } });
  res.json(rows.map(mapTicket));
}));

readRouter.get("/audit", handler(async (_req, res) => {
  const rows = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  res.json(rows.map(mapAudit));
}));

/* --------------------------- platform settings --------------------------- */

readRouter.get("/settings", handler(async (_req, res) => {
  // Singleton: fall back to the schema defaults when the row doesn't exist yet.
  const row = await prisma.platformSettings.upsert({ where: { id: "platform" }, create: { id: "platform" }, update: {} });
  res.json(mapSettings(row));
}));

/* -------------------------------- emails -------------------------------- */

readRouter.get("/email/settings", handler(async (_req, res) => {
  const row = await prisma.emailSettings.upsert({ where: { id: "email" }, create: { id: "email" }, update: {} });
  res.json(mapEmailSettings(row));
}));

readRouter.get("/email/templates", handler(async (_req, res) => {
  const rows = await prisma.emailTemplate.findMany({ orderBy: { key: "asc" } });
  res.json(rows.map(mapEmailTemplate));
}));

readRouter.get("/email/log", handler(async (_req, res) => {
  const rows = await prisma.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  res.json(rows.map(mapEmailLog));
}));

/* ------------------------------ KPI overview ------------------------------ */

readRouter.get("/reports/overview", handler(async (_req, res) => {
  const [users, deposits, withdrawals, positions, tickets, bots] = await Promise.all([
    prisma.user.findMany({ select: { status: true, kyc: true } }),
    prisma.deposit.findMany({ where: { status: { in: ["PENDING", "ACTION_REQUIRED", "UNDER_REVIEW"] } }, select: { amount: true } }),
    prisma.withdrawal.findMany({ where: { status: { in: ["PENDING", "UNDER_REVIEW", "APPROVED"] } }, select: { amount: true } }),
    prisma.position.findMany({ select: { status: true, amount: true, payout: true, openedAt: true } }),
    prisma.ticket.count({ where: { status: { in: ["OPEN", "PENDING"] } } }),
    prisma.bot.findMany({ select: { stake: true, total: true } }),
  ]);

  const settled = positions.filter((p) => p.status !== "OPEN");
  const netPnlToday = settled.reduce((s, p) => s + (p.status === "WON" ? -(p.payout ?? 0) : p.amount), 0);
  const sum = (arr: { amount: number }[]) => arr.reduce((s, x) => s + x.amount, 0);

  // Weekly deposits vs withdrawals from the ledger, bucketed by weekday label.
  const since = new Date();
  since.setDate(since.getDate() - 6);
  const led = await prisma.ledgerEntry.findMany({
    where: { createdAt: { gte: since }, type: { in: ["DEPOSIT", "WITHDRAWAL"] } },
    select: { type: true, amount: true, createdAt: true },
  });
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const buckets: Record<string, { deposits: number; withdrawals: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    buckets[labels[d.getDay()]] = { deposits: 0, withdrawals: 0 };
  }
  for (const e of led) {
    const key = labels[e.createdAt.getDay()];
    const b = buckets[key];
    if (!b) continue;
    if (e.type === "DEPOSIT") b.deposits += Math.abs(e.amount);
    else b.withdrawals += Math.abs(e.amount);
  }
  const volumeSeries = Object.entries(buckets).map(([label, v]) => ({ label, ...v }));

  res.json({
    activeUsers: users.filter((u) => u.status === "ACTIVE").length,
    pendingDepositCount: deposits.length,
    pendingDepositValue: sum(deposits),
    pendingWithdrawalCount: withdrawals.length,
    pendingWithdrawalValue: sum(withdrawals),
    openPositions: positions.filter((p) => p.status === "OPEN").length,
    netPnlToday,
    openTickets: tickets,
    verifiedPct: users.length ? Math.round((users.filter((u) => u.kyc === "APPROVED").length / users.length) * 100) : 0,
    botVolume: bots.reduce((s: number, b: { stake: number; total: number }) => s + b.stake * b.total, 0),
    volumeSeries,
  });
}));
