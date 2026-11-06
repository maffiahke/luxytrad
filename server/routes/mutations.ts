import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError, clientIp, handler } from "../lib/http";
import { authenticate, requireRole } from "../lib/auth";
import { writeAudit } from "../lib/audit";
import { accountReference, getAccessToken, loadMpesaOverridesFromDb, mpesaConfig, saveMpesaSettingsToDb, stkTransactionType, type MpesaSettingsOverride } from "../lib/mpesa";
import { encrypt } from "../lib/crypto";
import { parseCryptoConfig, validateCryptoAddress, type CryptoConfigBlob } from "../lib/crypto-gateway";
import { loadMarketMap, settlePositionRow, tickMarkets } from "../lib/engine";
import { sendAutoEmail, sendCustomMail, sendTemplateMail, verifyTransport } from "../lib/mailer";
import { mapEmailSettings, mapEmailTemplate, mapSettings } from "../lib/serializers";
import { notifyMpesaB2c, notifyUser } from "../lib/messages";

export const mutationRouter = Router();
mutationRouter.use(authenticate, requireRole()); // any role except READONLY

const idParam = z.string().min(1);
const reasonBody = z.object({ reason: z.string().min(1).max(300) });

/* ------------------------------- deposits ------------------------------- */

mutationRouter.post(
  "/deposits/:id/approve",
  requireRole("FINANCE", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const result = await prisma.$transaction(async (tx) => {
      const d = await tx.deposit.findUnique({ where: { id } });
      if (!d) throw new ApiError(404, "Deposit not found");
      const base = { userId: d.userId, amount: d.amount, method: d.channel, reference: d.mpesaCode ?? d.reference ?? "-" };
      if (d.status === "COMPLETED") {
        const u = await tx.user.findUnique({ where: { id: d.userId } });
        return { already: true, credited: d.credited, balance: u?.realBalance ?? 0, ...base };
      }
      await tx.deposit.update({ where: { id }, data: { status: "COMPLETED" } });
      const u = await tx.user.update({ where: { id: d.userId }, data: { realBalance: { increment: d.credited } } });
      await tx.ledgerEntry.create({
        data: { userId: d.userId, type: "DEPOSIT", amount: d.credited, balanceAfter: u.realBalance, note: `${d.channel} deposit approved` },
      });
      return { already: false, credited: d.credited, balance: u.realBalance, ...base };
    });
    await writeAudit(req.admin, "approve_deposit", "Deposit", req.params.id, clientIp(req));
    // Automatic "deposit confirmed" email (fire-and-forget; never blocks the credit).
    if (!result.already) {
      void sendAutoEmail("DEPOSIT_CONFIRMED", result.userId, {
        amount: result.credited.toFixed(2),
        method: result.method,
        reference: result.reference,
        balance: result.balance.toFixed(2),
      });
    }
    res.json({ ok: true, ...result });
  }),
);

mutationRouter.post(
  "/deposits/:id/reject",
  requireRole("FINANCE", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const { reason } = reasonBody.parse(req.body);
    const d = await prisma.deposit.findUnique({ where: { id } });
    if (!d) throw new ApiError(404, "Deposit not found");
    await prisma.deposit.update({ where: { id }, data: { status: "REJECTED", note: reason } });
    await writeAudit(req.admin, `reject_deposit (${reason})`, "Deposit", id, clientIp(req));
    void sendAutoEmail("DEPOSIT_REJECTED", d.userId, { amount: d.amount.toFixed(2), reason });
    res.json({ ok: true });
  }),
);

/* ------------------------------ withdrawals ----------------------------- */

mutationRouter.post(
  "/withdrawals/:id/ops-approve",
  requireRole("OPS", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const w = await prisma.withdrawal.findUnique({ where: { id } });
    if (!w) throw new ApiError(404, "Withdrawal not found");
    await prisma.withdrawal.update({ where: { id }, data: { opsApproved: true, status: "UNDER_REVIEW" } });
    await writeAudit(req.admin, "ops_approve_withdrawal", "Withdrawal", id, clientIp(req));
    void sendAutoEmail("WITHDRAWAL_APPROVED", w.userId, { amount: w.amount.toFixed(2), destination: w.destination });
    res.json({ ok: true });
  }),
);

mutationRouter.post(
  "/withdrawals/:id/pay",
  requireRole("FINANCE", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const result = await prisma.$transaction(async (tx) => {
      const w = await tx.withdrawal.findUnique({ where: { id } });
      if (!w) throw new ApiError(404, "Withdrawal not found");
      const base = { userId: w.userId, amount: w.amount, destination: w.destination };
      if (w.status === "COMPLETED") return { already: true, balance: 0, ...base };
      if (!w.opsApproved) throw new ApiError(409, "Withdrawal must be ops-approved before payment");
      const u = await tx.user.findUnique({ where: { id: w.userId } });
      if (!u) throw new ApiError(404, "User not found");
      if (u.realBalance < w.amount) throw new ApiError(409, "Insufficient balance for payout");
      await tx.withdrawal.update({ where: { id }, data: { status: "COMPLETED" } });
      const updated = await tx.user.update({ where: { id: w.userId }, data: { realBalance: { decrement: w.amount } } });
      await tx.ledgerEntry.create({
        data: { userId: w.userId, type: "WITHDRAWAL", amount: -w.amount, balanceAfter: updated.realBalance, note: `${w.channel} payout paid` },
      });
      return { already: false, balance: updated.realBalance, ...base };
    });
    await writeAudit(req.admin, "pay_withdrawal", "Withdrawal", id, clientIp(req));
    // Automatic "withdrawal paid" email (fire-and-forget; never blocks the payout).
    if (!result.already) {
      void sendAutoEmail("WITHDRAWAL_PAID", result.userId, {
        amount: result.amount.toFixed(2),
        destination: result.destination,
        balance: result.balance.toFixed(2),
      });
      // In-app B2C alert styled as the Safaricom "payment received" SMS — new
      // code / amount / timestamp / running balance on every payout (the
      // trader's Android "Messages" app raises it as a native notification).
      await notifyMpesaB2c({ userId: result.userId, amountUsd: result.amount });
    }
    res.json({ ok: true, ...result });
  }),
);

mutationRouter.post(
  "/withdrawals/:id/reject",
  requireRole("FINANCE", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const { reason } = reasonBody.parse(req.body);
    const w = await prisma.withdrawal.findUnique({ where: { id } });
    if (!w) throw new ApiError(404, "Withdrawal not found");
    await prisma.withdrawal.update({ where: { id }, data: { status: "REJECTED", note: reason } });
    await writeAudit(req.admin, `reject_withdrawal (${reason})`, "Withdrawal", id, clientIp(req));
    void sendAutoEmail("WITHDRAWAL_REJECTED", w.userId, { amount: w.amount.toFixed(2), reason });
    // In-app alert for the rejected payout (same feed the Android app notifies on).
    await notifyUser({ userId: w.userId, title: "MPESA", body: `Your payout of ${w.amount.toFixed(2)} was rejected. ${reason}` });
    res.json({ ok: true });
  }),
);

/* ------------------------------- positions ------------------------------ */

mutationRouter.post(
  "/positions/:id/settle",
  handler(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const { won } = z.object({ won: z.boolean() }).parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      const p = await tx.position.findUnique({ where: { id }, include: { user: { select: { realBalance: true } } } });
      if (!p) throw new ApiError(404, "Position not found");
      if (p.status !== "OPEN") return { already: true, id };
      // payout mirrors the mock: round(amount * market payoutPct%) using the market when present.
      const market = await tx.market.findFirst({ where: { OR: [{ code: p.market }, { name: p.market }] } });
      const pct = market?.payoutPct ?? 87;
      const payout = won ? Math.round(p.amount * (pct / 100)) : 0;
      await tx.position.update({
        where: { id },
        data: { status: won ? "WON" : "LOST", payout, closePrice: p.closePrice ?? p.entryPrice, expiresAt: new Date() },
      });
      let balanceAfter = p.user?.realBalance ?? 0;
      if (won) {
        const u = await tx.user.update({ where: { id: p.userId }, data: { realBalance: { increment: payout } } });
        balanceAfter = u.realBalance;
        await tx.ledgerEntry.create({
          data: { userId: p.userId, type: "TRADE_CREDIT", amount: payout, balanceAfter, note: `Won ${p.market} ${p.side}` },
        });
      }
      return { already: false, payout, balanceAfter };
    });
    await writeAudit(req.admin, "settle_position", "Position", id, clientIp(req));
    res.json({ ok: true, ...result });
  }),
);

/* --------------------------------- users -------------------------------- */

mutationRouter.post(
  "/bots/:id/kill",
  handler(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const bot = await prisma.bot.findUnique({ where: { id } });
    if (!bot) throw new ApiError(404, "Bot not found");
    // settle the in-flight trade so killing the bot leaves no dangling position.
    if (bot.activeId) {
      const pos = await prisma.position.findFirst({ where: { id: bot.activeId, userId: bot.userId, status: "OPEN" } });
      if (pos) {
        await tickMarkets();
        const markets = await loadMarketMap();
        const m = markets.get(pos.market);
        const u = await prisma.user.findUnique({ where: { id: bot.userId }, select: { winRate: true } });
        const settings = await prisma.platformSettings.upsert({ where: { id: "platform" }, create: { id: "platform" }, update: {} });
        await settlePositionRow(
          pos,
          m ? m.basePrice : pos.entryPrice,
          typeof u?.winRate === "number" ? u.winRate : null,
          m?.payoutPct ?? settings.defaultPayoutPct,
        );
      }
    }
    await prisma.bot.update({ where: { id }, data: { status: "STOPPED", stoppedAt: new Date(), activeId: null } });
    await writeAudit(req.admin, "kill_bot", "Bot", id, clientIp(req));
    res.json({ ok: true });
  }),
);

mutationRouter.post(
  "/users/:id/adjust-balance",
  requireRole("FINANCE", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const { delta, note } = z.object({ delta: z.number(), note: z.string().min(1).max(200) }).parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      const u = await tx.user.findUnique({ where: { id } });
      if (!u) throw new ApiError(404, "User not found");
      const realBalance = Math.max(0, u.realBalance + delta);
      const updated = await tx.user.update({ where: { id }, data: { realBalance } });
      await tx.ledgerEntry.create({
        data: { userId: id, type: "ADJUSTMENT", amount: delta, balanceAfter: updated.realBalance, note },
      });
      return { balanceAfter: updated.realBalance };
    });
    await writeAudit(req.admin, `balance_adjust (${delta})`, "User", id, clientIp(req));
    res.json({ ok: true, ...result });
  }),
);

mutationRouter.post(
  "/users/:id/status",
  handler(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const { status } = z.object({ status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]) }).parse(req.body);
    await prisma.user.update({ where: { id }, data: { status } });
    await writeAudit(req.admin, `set_user_${status.toLowerCase()}`, "User", id, clientIp(req));
    res.json({ ok: true });
  }),
);

mutationRouter.post(
  "/users/:id/auto-payout",
  requireRole("FINANCE", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new ApiError(404, "User not found");
    await prisma.user.update({ where: { id }, data: { autoPayout: enabled } });
    await writeAudit(req.admin, enabled ? "enable_auto_payout" : "disable_auto_payout", "User", id, clientIp(req));
    res.json({ ok: true, autoPayout: enabled });
  }),
);

mutationRouter.post(
  "/users/:id/win-rate",
  requireRole("SUPER_ADMIN"),
  handler(async (req, res) => {
    const id = idParam.parse(req.params.id);
    // null clears the override so the user's trades settle on real price again.
    const { winRate } = z.object({ winRate: z.number().min(0).max(100).nullable() }).parse(req.body);
    await prisma.user.update({ where: { id }, data: { winRate } });
    await writeAudit(req.admin, winRate === null ? "user_winrate_clear" : `user_winrate_set (${winRate}%)`, "User", id, clientIp(req));
    res.json({ ok: true });
  }),
);

const userEmailBody = z
  .object({
    template: z.string().trim().min(1).optional(),
    subject: z.string().trim().max(200).optional(),
    body: z.string().max(20000).optional(),
  })
  .refine((b) => Boolean(b.template) || Boolean(b.subject && b.body), {
    message: "Provide a template or both a subject and a body",
  });

mutationRouter.post(
  "/users/:id/email",
  requireRole("SUPPORT", "OPS", "SUPER_ADMIN"),
  handler(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const body = userEmailBody.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id }, select: { email: true, fullName: true } });
    if (!user) throw new ApiError(404, "User not found");
    if (!user.email) throw new ApiError(400, "User has no email address on file");
    const vars = { name: user.fullName.split(" ")[0] || user.fullName, email: user.email };
    // Admin-initiated send bypasses the automatic-email gates (`force`).
    const result = body.template
      ? await sendTemplateMail({ to: user.email, template: body.template, vars, force: true })
      : await sendCustomMail({ to: user.email, subject: body.subject!, body: body.body!, vars, force: true });
    if (!result.ok) {
      res.status(502).json({ ok: false, error: result.error ?? "Send failed" });
      return;
    }
    await writeAudit(req.admin, "user_email_send", "User", id, clientIp(req));
    res.json({ ok: true });
  }),
);

/* ---------------------------------- kyc --------------------------------- */

mutationRouter.post(
  "/kyc/:id/approve",
  handler(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const k = await prisma.kycApplication.findUnique({ where: { id } });
    if (!k) throw new ApiError(404, "KYC application not found");
    await prisma.$transaction([
      prisma.kycApplication.update({ where: { id }, data: { status: "APPROVED" } }),
      prisma.user.update({ where: { id: k.userId }, data: { kyc: "APPROVED" } }),
    ]);
    await writeAudit(req.admin, "kyc_approve", "User", k.userId, clientIp(req));
    void sendAutoEmail("KYC_APPROVED", k.userId, {});
    res.json({ ok: true });
  }),
);

mutationRouter.post(
  "/kyc/:id/reject",
  handler(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const { reason } = reasonBody.parse(req.body);
    const k = await prisma.kycApplication.findUnique({ where: { id } });
    if (!k) throw new ApiError(404, "KYC application not found");
    await prisma.$transaction([
      prisma.kycApplication.update({ where: { id }, data: { status: "REJECTED", note: reason } }),
      prisma.user.update({ where: { id: k.userId }, data: { kyc: "REJECTED" } }),
    ]);
    await writeAudit(req.admin, `kyc_reject (${reason})`, "User", k.userId, clientIp(req));
    void sendAutoEmail("KYC_REJECTED", k.userId, { reason });
    res.json({ ok: true });
  }),
);

/* ------------------------------- gateways ------------------------------- */

mutationRouter.post(
  "/gateways/:key/toggle",
  requireRole("SUPER_ADMIN"),
  handler(async (req, res) => {
    const key = idParam.parse(req.params.key);
    const g = await prisma.gateway.findUnique({ where: { key } });
    if (!g) throw new ApiError(404, "Gateway not found");
    const updated = await prisma.gateway.update({ where: { key }, data: { enabled: !g.enabled } });
    await writeAudit(req.admin, updated.enabled ? "gateway_enable" : "gateway_disable", "Gateway", key, clientIp(req));
    res.json({ ok: true, enabled: updated.enabled });
  }),
);

/* ------------------------- M-Pesa gateway settings ------------------------ */

const mpesaSettingsBody = z.object({
  env: z.enum(["production", "sandbox"]).optional(),
  transactionType: z.enum(["CustomerBuyGoodsOnline", "CustomerPayBillOnline"]).optional(),
  shortcode: z.string().max(20).optional(),
  tillNumber: z.string().max(20).optional(),
  callbackUrl: z.string().url().optional().or(z.literal("")),
  accountRef: z.string().max(40).optional(),
  transactionDesc: z.string().max(100).optional(),
  kesRate: z.coerce.number().positive().optional(),
  consumerKey: z.string().max(120).optional(),
  consumerSecret: z.string().max(120).optional(),
  passkey: z.string().max(120).optional(),
});

mutationRouter.post(
  "/gateways/mpesa/settings",
  requireRole("SUPER_ADMIN"),
  handler(async (req, res) => {
    const body = mpesaSettingsBody.parse(req.body);
    const override: MpesaSettingsOverride = {};
    if (body.env) override.env = body.env;
    if (body.transactionType) override.transactionType = body.transactionType;
    if (body.shortcode !== undefined) override.shortcode = body.shortcode.trim();
    if (body.tillNumber !== undefined) override.tillNumber = body.tillNumber.trim();
    if (body.callbackUrl !== undefined) override.callbackUrl = body.callbackUrl.trim();
    if (body.accountRef !== undefined) override.accountRef = body.accountRef.trim();
    if (body.transactionDesc !== undefined) override.transactionDesc = body.transactionDesc.trim();
    if (body.kesRate !== undefined) override.kesRate = body.kesRate;
    // Only rotate a secret when the admin actually typed a new value; a blank
    // field (or the masked placeholder) keeps the existing credential intact.
    const keepIfBlank = (v?: string) => v && !v.startsWith("•") && v.trim() ? v.trim() : undefined;
    const ck = keepIfBlank(body.consumerKey);
    const cs = keepIfBlank(body.consumerSecret);
    const pk = keepIfBlank(body.passkey);
    if (ck) override.consumerKey = ck;
    if (cs) override.consumerSecret = cs;
    if (pk) override.passkey = pk;

    await saveMpesaSettingsToDb(override);
    await writeAudit(req.admin, "mpesa_gateway_config", "Gateway", "mpesa", clientIp(req));
    const cfg = mpesaConfig();
    res.json({
      ok: true,
      persisted: true,
      env: cfg.env,
      transactionType: stkTransactionType(cfg),
      businessShortCode: cfg.shortcode || cfg.tillNumber,
      accountReference: accountReference(cfg),
      callbackUrl: cfg.callbackUrl,
      secretsSet: { consumerKey: Boolean(cfg.consumerKey), consumerSecret: Boolean(cfg.consumerSecret), passkey: Boolean(cfg.passkey) },
    });
  }),
);

mutationRouter.post(
  "/gateways/mpesa/test",
  requireRole("SUPER_ADMIN"),
  handler(async (_req, res) => {
    await loadMpesaOverridesFromDb(true);
    const cfg = mpesaConfig();
    try {
      await getAccessToken(cfg);
      res.json({ ok: true, env: cfg.env, host: cfg.host, message: "Daraja credentials accepted" });
    } catch (err) {
      const e = err as { payload?: unknown; message?: string };
      res.status(502).json({ ok: false, env: cfg.env, host: cfg.host, error: "OAuth failed — check Consumer Key / Secret", detail: e?.payload ?? e?.message });
    }
  }),
);

/* ------------------------ crypto gateway settings ------------------------ */

const cryptoBody = z
  .object({
    network: z.string().trim().min(1).max(40),
    address: z.string().trim().min(6).max(120),
    confirmations: z.number().int().min(1).max(100),
    autoCredit: z.boolean(),
    callbackUrl: z.string().trim().max(300),
    minAmount: z.number().min(0),
    maxAmount: z.number().min(0),
    feePct: z.number().min(0).max(100),
    feeFixed: z.number().min(0),
    apiKey: z.string().trim().max(200).optional(),
  })
  .refine((s) => s.maxAmount >= s.minAmount, { message: "maxAmount must be ≥ minAmount", path: ["maxAmount"] });

mutationRouter.post(
  "/gateways/:key/settings",
  requireRole("SUPER_ADMIN"),
  handler(async (req, res) => {
    const key = idParam.parse(req.params.key);
    const body = cryptoBody.parse(req.body);
    const g = await prisma.gateway.findUnique({ where: { key } });
    if (!g) throw new ApiError(404, "Gateway not found");
    if (!g.kind.startsWith("CRYPTO_")) throw new ApiError(400, "Not a crypto gateway");

    // Keep the existing explorer key when the admin leaves the field blank.
    const existing = parseCryptoConfig(g.secretEnc) ?? {};
    const blob: CryptoConfigBlob = {
      network: body.network,
      address: body.address,
      confirmations: body.confirmations,
      autoCredit: body.autoCredit,
      callbackUrl: body.callbackUrl,
      ...(body.apiKey ? { apiKey: body.apiKey } : existing.apiKey ? { apiKey: existing.apiKey } : {}),
    };

    await prisma.gateway.update({
      where: { key },
      data: {
        minAmount: body.minAmount,
        maxAmount: body.maxAmount,
        feePct: body.feePct,
        feeFixed: body.feeFixed,
        secretEnc: encrypt(JSON.stringify(blob)),
      },
    });
    await writeAudit(req.admin, "crypto_gateway_config", "Gateway", key, clientIp(req));
    res.json({ ok: true, network: blob.network, apiKeySet: Boolean(blob.apiKey) });
  }),
);

mutationRouter.post(
  "/gateways/:key/test",
  requireRole("SUPER_ADMIN"),
  handler(async (req, res) => {
    const key = idParam.parse(req.params.key);
    const g = await prisma.gateway.findUnique({ where: { key } });
    if (!g) throw new ApiError(404, "Gateway not found");
    if (!g.kind.startsWith("CRYPTO_")) throw new ApiError(400, "Not a crypto gateway");
    const c = parseCryptoConfig(g.secretEnc);
    if (!c?.address) {
      res.status(400).json({ ok: false, error: "Receiving wallet address is required" });
      return;
    }
    if (!validateCryptoAddress(c.network ?? "", c.address)) {
      res.status(400).json({ ok: false, error: `"${c.address}" is not a valid ${c.network ?? ""} address` });
      return;
    }
    res.json({ ok: true, message: `${g.label} — ${c.network} address accepted · ${c.confirmations ?? 2} confirmation(s) required` });
  }),
);

mutationRouter.post(
  "/gateways/callbacks/:id/process",
  requireRole("FINANCE", "SUPER_ADMIN", "OPS"),
  handler(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const c = await prisma.gatewayCallback.findUnique({ where: { id } });
    if (!c) throw new ApiError(404, "Callback not found");
    if (!c.signatureValid) throw new ApiError(409, "Callback signature invalid — cannot process");
    await prisma.gatewayCallback.update({ where: { id }, data: { processed: true } });
    await writeAudit(req.admin, "callback_match", "Callback", id, clientIp(req));
    res.json({ ok: true });
  }),
);

/* -------------------------------- tickets ------------------------------- */

mutationRouter.post(
  "/tickets/:id/reply",
  handler(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const { body } = z.object({ body: z.string().min(1).max(4000) }).parse(req.body);
    await prisma.$transaction([
      prisma.ticketMessage.create({ data: { ticketId: id, fromAdmin: true, body } }),
      prisma.ticket.update({ where: { id }, data: { status: "PENDING" } }),
    ]);
    await writeAudit(req.admin, "ticket_reply", "Ticket", id, clientIp(req));
    res.json({ ok: true });
  }),
);

mutationRouter.post(
  "/tickets/:id/status",
  handler(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const { status } = z.object({ status: z.enum(["OPEN", "PENDING", "RESOLVED", "CLOSED"]) }).parse(req.body);
    await prisma.ticket.update({ where: { id }, data: { status } });
    await writeAudit(req.admin, `ticket_${status.toLowerCase()}`, "Ticket", id, clientIp(req));
    res.json({ ok: true });
  }),
);

/* -------------------------------- markets ------------------------------- */

mutationRouter.post(
  "/markets/:code/payout",
  requireRole("SUPER_ADMIN", "OPS"),
  handler(async (req, res) => {
    const code = idParam.parse(req.params.code);
    const { payoutPct } = z.object({ payoutPct: z.number().min(0).max(100) }).parse(req.body);
    await prisma.market.update({ where: { code }, data: { payoutPct } });
    await writeAudit(req.admin, "market_payout_update", "Market", code, clientIp(req));
    res.json({ ok: true });
  }),
);

mutationRouter.post(
  "/markets/:code/toggle",
  requireRole("SUPER_ADMIN", "OPS"),
  handler(async (req, res) => {
    const code = idParam.parse(req.params.code);
    const m = await prisma.market.findUnique({ where: { code } });
    if (!m) throw new ApiError(404, "Market not found");
    const updated = await prisma.market.update({ where: { code }, data: { active: !m.active } });
    await writeAudit(req.admin, "market_toggle", "Market", code, clientIp(req));
    res.json({ ok: true, active: updated.active });
  }),
);

/* --------------------------- platform settings -------------------------- */

const settingsBody = z
  .object({
    minDeposit: z.number().positive(),
    maxDeposit: z.number().positive(),
    minWithdrawal: z.number().positive(),
    maxWithdrawal: z.number().positive(),
    dailyWithdrawalCap: z.number().positive(),
    defaultDepositBonus: z.number().min(0).max(500),
    maxBonus: z.number().min(0),
    kycRequiredToWithdraw: z.boolean(),
    maxOpenPositionsPerUser: z.number().int().min(1).max(200),
    defaultPayoutPct: z.number().min(1).max(100),
  })
  .refine((s) => s.maxDeposit >= s.minDeposit, { message: "maxDeposit must be ≥ minDeposit", path: ["maxDeposit"] })
  .refine((s) => s.maxWithdrawal >= s.minWithdrawal, { message: "maxWithdrawal must be ≥ minWithdrawal", path: ["maxWithdrawal"] })
  .refine((s) => s.dailyWithdrawalCap >= s.maxWithdrawal, { message: "dailyWithdrawalCap must be ≥ maxWithdrawal", path: ["dailyWithdrawalCap"] });

mutationRouter.post(
  "/settings",
  requireRole("SUPER_ADMIN"),
  handler(async (req, res) => {
    const body = settingsBody.parse(req.body);
    const row = await prisma.platformSettings.upsert({
      where: { id: "platform" },
      create: { id: "platform", ...body },
      update: body,
    });
    await writeAudit(req.admin, "platform_settings_update", "Settings", "platform", clientIp(req));
    res.json({ ok: true, settings: mapSettings(row) });
  }),
);

/* ---------------------------------- email --------------------------------- */

const emailSettingsBody = z.object({
  enabled: z.boolean(),
  host: z.string().trim().max(200),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  username: z.string().trim().max(200),
  fromName: z.string().trim().max(120),
  fromEmail: z.string().trim().email(),
  replyTo: z.string().trim().email().or(z.literal("")),
  // Plain SMTP password — only present when the admin is rotating it.
  password: z.string().max(200).optional(),
});

mutationRouter.post(
  "/email/settings",
  requireRole("SUPER_ADMIN"),
  handler(async (req, res) => {
    const body = emailSettingsBody.parse(req.body);
    // Rotate the password only when a new value was typed; a blank field (or the
    // masked placeholder) keeps the existing credential intact.
    const typed = body.password && !body.password.startsWith("•") ? body.password.trim() : "";
    const fields = {
      enabled: body.enabled,
      host: body.host,
      port: body.port,
      secure: body.secure,
      username: body.username,
      fromName: body.fromName,
      fromEmail: body.fromEmail,
      replyTo: body.replyTo,
    };
    const row = await prisma.emailSettings.upsert({
      where: { id: "email" },
      create: { id: "email", ...fields, ...(typed ? { passwordEnc: encrypt(typed) } : {}) },
      update: { ...fields, ...(typed ? { passwordEnc: encrypt(typed) } : {}) },
    });
    await writeAudit(req.admin, "email_settings_update", "EmailSettings", "email", clientIp(req));
    res.json({ ok: true, settings: mapEmailSettings(row) });
  }),
);

const emailTemplateBody = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(300),
  category: z.enum(["Account", "Money", "Compliance", "Security"]),
  subject: z.string().trim().min(1).max(200),
  body: z.string().min(1).max(20000),
  variables: z.array(z.string()).default([]),
  enabled: z.boolean().optional(),
});

mutationRouter.post(
  "/email/templates/:key",
  requireRole("SUPER_ADMIN"),
  handler(async (req, res) => {
    const key = idParam.parse(req.params.key);
    const body = emailTemplateBody.parse(req.body);
    const existing = await prisma.emailTemplate.findUnique({ where: { key } });
    const row = await prisma.emailTemplate.upsert({
      where: { key },
      create: {
        key,
        name: body.name,
        description: body.description,
        category: body.category,
        subject: body.subject,
        body: body.body,
        variables: body.variables,
        enabled: body.enabled ?? true,
      },
      update: {
        name: body.name,
        description: body.description,
        category: body.category,
        subject: body.subject,
        body: body.body,
        variables: body.variables,
        ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      },
    });
    await writeAudit(req.admin, existing ? "email_template_update" : "email_template_create", "EmailTemplate", key, clientIp(req));
    res.json({ ok: true, template: mapEmailTemplate(row) });
  }),
);

mutationRouter.post(
  "/email/templates/:key/toggle",
  requireRole("SUPER_ADMIN"),
  handler(async (req, res) => {
    const key = idParam.parse(req.params.key);
    const t = await prisma.emailTemplate.findUnique({ where: { key } });
    if (!t) throw new ApiError(404, "Template not found");
    const row = await prisma.emailTemplate.update({ where: { key }, data: { enabled: !t.enabled } });
    await writeAudit(req.admin, row.enabled ? "email_template_enable" : "email_template_disable", "EmailTemplate", key, clientIp(req));
    res.json({ ok: true, enabled: row.enabled });
  }),
);

mutationRouter.post(
  "/email/test-send",
  requireRole("SUPER_ADMIN"),
  handler(async (req, res) => {
    const { to, template } = z.object({ to: z.string().trim().email(), template: z.string().trim().min(1) }).parse(req.body);
    // Replace {{vars}} with representative sample values so any template renders.
    const sample: Record<string, string> = {
      name: "Trader",
      email: to,
      amount: "100.00",
      method: "M-Pesa",
      reference: "TEST1234",
      destination: "0712 345 678",
      balance: "1,250.00",
      reason: "This is a test email sent from the admin console.",
      link: "https://luxytrades.io/reset/test",
    };
    // `force` bypasses the master/template disabled gates — a test must always send.
    const result = await sendTemplateMail({ to, template, vars: sample, force: true });
    if (!result.ok) {
      res.status(502).json({ ok: false, error: result.error ?? "Send failed" });
      return;
    }
    await writeAudit(req.admin, "email_test_send", "EmailLog", template, clientIp(req));
    res.json({ ok: true });
  }),
);

mutationRouter.post(
  "/email/test-connection",
  requireRole("SUPER_ADMIN"),
  handler(async (_req, res) => {
    const result = await verifyTransport();
    if (!result.ok) {
      res.status(502).json({ ok: false, error: result.message });
      return;
    }
    res.json({ ok: true, message: result.message });
  }),
);

/* --------------------------- CSV stream export -------------------------- */

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

mutationRouter.get(
  "/reports/export/:kind",
  handler(async (req, res) => {
    const kind = req.params.kind;
    const tableMap: Record<string, () => Promise<Record<string, unknown>[]>> = {
      deposits: async () => prisma.deposit.findMany({ include: { user: { select: { fullName: true } } } }) as unknown as Promise<Record<string, unknown>[]>,
      withdrawals: async () => prisma.withdrawal.findMany({ include: { user: { select: { fullName: true } } } }) as unknown as Promise<Record<string, unknown>[]>,
      ledger: async () => prisma.ledgerEntry.findMany({ include: { user: { select: { fullName: true } } } }) as unknown as Promise<Record<string, unknown>[]>,
      users: async () => prisma.user.findMany() as unknown as Promise<Record<string, unknown>[]>,
    };
    const loader = tableMap[kind];
    if (!loader) throw new ApiError(404, "Unknown export kind");
    const rows = await loader();
    if (rows.length === 0) { res.type("text/csv").send(""); return; }
    const cols = Object.keys(rows[0]).filter((c) => typeof rows[0][c] !== "object");
    const head = cols.join(",");
    const body = rows.map((r) => cols.map((c) => csvEscape((r as Record<string, unknown>)[c])).join(",")).join("\n");
    res.setHeader("Content-Disposition", `attachment; filename="${kind}.csv"`);
    res.type("text/csv").send(`${head}\n${body}`);
  }),
);
