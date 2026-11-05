import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError, handler } from "../lib/http";
import { authenticateTrader } from "../lib/traderAuth";
import { sendAutoEmail } from "../lib/mailer";
import {
  accountReference,
  businessShortCode,
  isMpesaConfigured,
  loadMpesaOverridesFromDb,
  mpesaConfig,
  stkTransactionType,
  stkpush,
  stkquery,
  type StkQueryResult,
} from "../lib/mpesa";
import type { Deposit } from "@prisma/client";

/**
 * M-Pesa STK push (Safaricom). Everything is persisted in Postgres:
 *
 *   POST /stkpush        — trader initiates; a PENDING Deposit row is created (no credit).
 *   POST /callback       — Safaricom's async confirmation; the ONLY place a deposit is credited.
 *   GET  /status/:id     — trader polls; queries Daraja directly and settles if needed.
 *
 * A deposit can be credited exactly once: settlement is guarded by a conditional
 * update on the Deposit row, so a duplicate callback or a status poll racing the
 * callback can never double-credit.
 */
export const paymentsRouter = Router();

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ------------------------------- settlement ------------------------------- */

/** Flip a pending deposit to COMPLETED and credit the trader's real wallet once. */
async function settleDeposit(d: Deposit, receipt?: string, amountKes?: number): Promise<{ credited: boolean; balance: number }> {
  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.deposit.updateMany({
      where: { id: d.id, status: { not: "COMPLETED" } },
      data: { status: "COMPLETED", mpesaCode: receipt ?? d.mpesaCode, amountKes: amountKes ?? d.amountKes, note: "STK confirmed" },
    });
    if (claimed.count === 0) {
      const u = await tx.user.findUnique({ where: { id: d.userId }, select: { realBalance: true } });
      return { credited: false, balance: u?.realBalance ?? 0 };
    }
    const u = await tx.user.update({ where: { id: d.userId }, data: { realBalance: { increment: d.credited } } });
    await tx.ledgerEntry.create({
      data: {
        userId: d.userId,
        type: "DEPOSIT",
        amount: d.credited,
        balanceAfter: u.realBalance,
        note: `M-Pesa ${receipt ?? d.mpesaCode ?? ""}`.trim(),
      },
    });
    await tx.auditLog.create({
      data: { admin: "M-Pesa", action: "mpesa_deposit", entity: "Deposit", entityId: d.id, ip: "mpesa" },
    });
    return { credited: true, balance: u.realBalance };
  });

  if (result.credited) {
    void sendAutoEmail("DEPOSIT_CONFIRMED", d.userId, {
      amount: d.credited.toFixed(2),
      method: "M-Pesa",
      reference: receipt ?? d.mpesaCode ?? d.id,
      balance: result.balance.toFixed(2),
    });
  }
  return result;
}

/** Mark a pending deposit as failed (Safaricom refused / the user cancelled). */
async function failDeposit(d: Deposit, note: string): Promise<void> {
  await prisma.deposit.updateMany({ where: { id: d.id, status: { not: "COMPLETED" } }, data: { status: "FAILED", note } });
}

const statusOf = (s: Deposit["status"]): "PENDING" | "SUCCESS" | "FAILED" => {
  if (s === "COMPLETED") return "SUCCESS";
  if (s === "FAILED" || s === "REJECTED") return "FAILED";
  return "PENDING";
};

/* ------------------------------- stk push ------------------------------- */

const stkBody = z.object({
  phone: z.string().min(7),
  amountUsd: z.coerce.number().positive(),
  bonusPct: z.coerce.number().min(0).max(1000).optional(),
  accountRef: z.string().max(40).optional(),
});

paymentsRouter.post(
  "/stkpush",
  authenticateTrader,
  handler(async (req, res) => {
    const userId = req.trader!.sub;
    await loadMpesaOverridesFromDb();
    const cfg = mpesaConfig();
    const { phone, amountUsd, accountRef } = stkBody.parse(req.body);

    if (!isMpesaConfigured(cfg)) {
      res.status(503).json({
        configured: false,
        error: "M-Pesa gateway not configured — the head-office paybill shortcode (MPESA_SHORTCODE) is required",
        amountKes: Math.round(amountUsd * cfg.kesRate),
        kesRate: cfg.kesRate,
      });
      return;
    }

    const gateway = await prisma.gateway.findUnique({ where: { key: "mpesa" } });
    if (!gateway?.enabled) throw new ApiError(403, "M-Pesa deposits are currently disabled");

    const settings = await prisma.platformSettings.upsert({ where: { id: "platform" }, create: { id: "platform" }, update: {} });
    const min = Math.max(settings.minDeposit, gateway.minAmount);
    const max = gateway.maxAmount > 0 ? Math.min(settings.maxDeposit, gateway.maxAmount) : settings.maxDeposit;
    if (amountUsd < min) throw new ApiError(400, `Minimum M-Pesa deposit is $${min}`);
    if (amountUsd > max) throw new ApiError(400, `Maximum M-Pesa deposit is $${max}`);

    // Bonus is decided server-side (never trusted from the client): 100% on $100+,
    // capped by the platform's max bonus.
    const bonusPct = amountUsd >= 100 ? Math.min(100, settings.defaultDepositBonus) : 0;
    const bonus = Math.min((amountUsd * bonusPct) / 100, settings.maxBonus);
    const credited = round2(amountUsd + bonus);
    const amountKes = Math.round(amountUsd * cfg.kesRate);

    const deposit = await prisma.deposit.create({
      data: {
        userId,
        channel: "MPESA",
        amount: round2(amountUsd),
        bonusPct,
        credited,
        status: "PENDING",
        amountKes,
        reference: accountReference(cfg, accountRef),
        note: "STK push requested",
      },
    });

    let result;
    try {
      result = await stkpush({ phone, amountKes, accountRef });
    } catch (err) {
      const e = err as { payload?: unknown; message?: string };
      console.error("[mpesa] stkpush failed", e?.payload ?? e?.message ?? err);
      await failDeposit(deposit, "STK push rejected by Safaricom");
      throw new ApiError(502, "M-Pesa request rejected by Safaricom. Check gateway credentials and shortcode.");
    }

    if (String(result.ResponseCode ?? "") !== "0") {
      await failDeposit(deposit, result.ResponseDescription || "STK push refused");
      throw new ApiError(400, result.ResponseDescription || "STK push could not be initiated");
    }

    await prisma.deposit.update({
      where: { id: deposit.id },
      data: { checkoutRequestId: result.CheckoutRequestID, note: "STK push sent" },
    });

    res.json({
      checkoutRequestId: result.CheckoutRequestID,
      requestId: result.RequestID,
      responseCode: result.ResponseCode,
      customerMessage: result.CustomerMessage,
      amountKes,
      businessShortCode: businessShortCode(cfg),
      transactionType: stkTransactionType(cfg),
      accountReference: accountReference(cfg, accountRef),
    });
  }),
);

/* -------------------------------- callback ------------------------------- */

interface DarajaCallbackBody {
  Body?: { stkCallback?: Record<string, unknown> };
}

function metaItem(body: Record<string, unknown>, name: string): unknown {
  const meta = (body.CallbackMetadata as { Item?: { Name: string; Value?: unknown }[] }) ?? undefined;
  const item = meta?.Item?.find((i) => i.Name === name);
  return item?.Value;
}

paymentsRouter.post(
  "/callback",
  handler(async (req, res) => {
    const payload = (req.body ?? {}) as DarajaCallbackBody;
    const cb = payload.Body?.stkCallback;
    if (!cb) {
      // Nothing we recognise — still ACK so Safaricom stops retrying with noise.
      res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted (ignored)" });
      return;
    }
    const id = String(cb.CheckoutRequestID ?? "");
    const resultCode = Number(cb.ResultCode ?? -1);
    const resultDesc = String(cb.ResultDesc ?? "");
    const receipt = metaItem(cb, "MpesaReceiptNumber") != null ? String(metaItem(cb, "MpesaReceiptNumber")) : undefined;
    const amountKes = metaItem(cb, "Amount") != null ? Number(metaItem(cb, "Amount")) : undefined;

    const deposit = await prisma.deposit.findUnique({ where: { checkoutRequestId: id } });
    if (!deposit) {
      console.warn("[mpesa] callback for unknown checkout", id, resultCode, resultDesc);
      res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
      return;
    }

    if (resultCode === 0) await settleDeposit(deposit, receipt, amountKes);
    else await failDeposit(deposit, resultDesc || `Declined (${resultCode})`);

    res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
  }),
);

/* -------------------------------- status -------------------------------- */

paymentsRouter.get(
  "/status/:id",
  authenticateTrader,
  handler(async (req, res) => {
    const id = req.params.id;
    const deposit = await prisma.deposit.findFirst({ where: { checkoutRequestId: id, userId: req.trader!.sub } });
    if (!deposit) throw new ApiError(404, "Unknown checkout request");
    await loadMpesaOverridesFromDb();

    let resultCode: number | undefined;
    let resultDesc: string | undefined;

    // Still pending? Ask Safaricom directly — the async callback may be delayed.
    if (deposit.status !== "COMPLETED" && deposit.status !== "FAILED" && isMpesaConfigured(mpesaConfig())) {
      try {
        const q: StkQueryResult = await stkquery(id, mpesaConfig());
        resultCode = q.ResultCode;
        resultDesc = q.ResultDesc;
        if (q.ResultCode === 0) {
          await settleDeposit(deposit, q.MpesaReceiptNumber ? String(q.MpesaReceiptNumber) : undefined, q.Amount ? Number(q.Amount) : undefined);
        } else if (q.ResultCode !== 1 && q.ResultCode !== 102) {
          // 1 = still processing on some responses, 102 = cancelled by the user.
          await failDeposit(deposit, q.ResultDesc || `Declined (${q.ResultCode})`);
        }
      } catch {
        /* query failed — report the last known state instead */
      }
    }

    const fresh = (await prisma.deposit.findUnique({ where: { id: deposit.id } }))!;
    res.json({
      checkoutRequestId: fresh.checkoutRequestId,
      status: statusOf(fresh.status),
      receipt: fresh.mpesaCode ?? undefined,
      amountUsd: fresh.amount,
      amountKes: fresh.amountKes ?? 0,
      resultCode,
      resultDesc,
    });
  }),
);
