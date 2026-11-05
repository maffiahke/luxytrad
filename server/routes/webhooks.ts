import { Router, raw } from "express";
import { prisma } from "../lib/prisma";
import { ApiError, handler } from "../lib/http";
import { verifySignature } from "../lib/crypto";

/**
 * Inbound gateway webhooks. These mount WITHOUT the bearer-auth middleware (the
 * caller is the gateway, not an admin) and are authenticated by an HMAC signature
 * over the raw request body. Mounted before the JSON body parser in index.ts.
 */
export const webhookRouter = Router();

function webhookSecret(gateway: string): string {
  const map: Record<string, string | undefined> = {
    mpesa: process.env.MPESA_WEBHOOK_SECRET,
    usdt: process.env.CRYPTO_WEBHOOK_SECRET,
    btc: process.env.CRYPTO_WEBHOOK_SECRET,
  };
  const s = map[gateway] ?? process.env.WEBHOOK_DEFAULT_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") throw new ApiError(500, "Webhook secret not configured");
    return "luxytrades-dev-webhook-secret";
  }
  return s;
}

/** Record + (if valid and matched) auto-settle a gateway callback. */
async function ingest(gatewayLabel: string, gatewayKey: string, sigValid: boolean, payload: {
  eventType: string; reference?: string; amount?: number;
}) {
  const cb = await prisma.gatewayCallback.create({
    data: {
      gateway: gatewayLabel,
      eventType: payload.eventType,
      reference: payload.reference ?? null,
      amount: payload.amount ?? null,
      signatureValid: sigValid,
      raw: payload as object,
    },
  });

  let matched = false;
  // Only a signature-valid confirmation with a known pending deposit can auto-credit.
  if (sigValid && payload.reference && payload.amount != null) {
    const deposit = await prisma.deposit.findFirst({
      where: { OR: [{ mpesaCode: payload.reference }, { reference: payload.reference }], status: { in: ["PENDING", "ACTION_REQUIRED", "UNDER_REVIEW"] } },
    });
    if (deposit) {
      await prisma.$transaction(async (tx) => {
        await tx.deposit.update({ where: { id: deposit.id }, data: { status: "COMPLETED" } });
        const u = await tx.user.update({ where: { id: deposit.userId }, data: { realBalance: { increment: deposit.credited } } });
        await tx.ledgerEntry.create({
          data: { userId: deposit.userId, type: "DEPOSIT", amount: deposit.credited, balanceAfter: u.realBalance, note: `${gatewayLabel} webhook ${payload.eventType}` },
        });
      });
      await prisma.gatewayCallback.update({ where: { id: cb.id }, data: { processed: true } });
      matched = true;
    }
  }
  void gatewayKey;
  return { id: cb.id, signatureValid: sigValid, matched };
}

// M-Pesa (Safaricom Daraja) STK push confirmation. Body parsed as raw Buffer for HMAC.
webhookRouter.post(
  "/webhooks/mpesa",
  raw({ type: "*/*" }),
  handler(async (req, res) => {
    const rawBody = req.body instanceof Buffer ? req.body.toString("utf8") : JSON.stringify(req.body ?? {});
    const sig = req.headers["x-luxy-signature"] ?? req.headers["x-mpesa-signature"];
    const sigValid = verifySignature(rawBody, String(sig ?? ""), webhookSecret("mpesa"));
    const parsed = req.body instanceof Buffer ? JSON.parse(rawBody || "{}") : (req.body ?? {});
    const out = await ingest("M-Pesa", "mpesa", sigValid, {
      eventType: parsed.EventType ?? "mpesa.stk.confirmation",
      reference: parsed.Reference ?? parsed.MpesaReceiptNumber ?? parsed.mpesaCode,
      amount: parsed.Amount != null ? Number(parsed.Amount) : undefined,
    });
    res.status(sigValid ? 200 : 400).json({ ok: sigValid, ...out });
  }),
);

// Crypto (USDT TRC20 / BTC) transfer confirmation.
webhookRouter.post(
  "/webhooks/crypto",
  raw({ type: "*/*" }),
  handler(async (req, res) => {
    const rawBody = req.body instanceof Buffer ? req.body.toString("utf8") : JSON.stringify(req.body ?? {});
    const sig = req.headers["x-luxy-signature"];
    const sigValid = verifySignature(rawBody, String(sig ?? ""), webhookSecret("usdt"));
    const parsed = req.body instanceof Buffer ? JSON.parse(rawBody || "{}") : (req.body ?? {});
    const label = parsed.asset === "BTC" ? "BTC" : "USDT";
    const out = await ingest(label, parsed.asset ?? "usdt", sigValid, {
      eventType: parsed.eventType ?? "tron.transfer",
      reference: parsed.txHash ?? parsed.reference,
      amount: parsed.amountUsd != null ? Number(parsed.amountUsd) : undefined,
    });
    res.status(sigValid ? 200 : 400).json({ ok: sigValid, ...out });
  }),
);
