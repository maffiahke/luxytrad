/**
 * Client for the public M-Pesa STK push API (server/routes/payments.ts), proxied
 * at /api/payments/mpesa in dev and served same-origin in production.
 *
 * These calls orchestrate the real Safaricom push + status polling. The trader's
 * USD balance is credited ONLY by the server once Safaricom confirms the checkout
 * (see server/routes/payments.ts settleDeposit) — the client never credits locally.
 * Both routes require the logged-in trader's Bearer token.
 */

import { getToken } from "./trader";

const BASE = "/api/payments/mpesa";

function authHeaders(): Record<string, string> {
  const token = getToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export interface StkInitSuccess {
  ok: true;
  checkoutRequestId: string;
  amountKes: number;
  businessShortCode: string;
  customerMessage: string;
  transactionType?: string;
  accountReference?: string;
}
export interface StkInitUnconfigured {
  ok: false;
  configured: false;
  amountKes: number;
  kesRate: number;
}
export interface StkInitError {
  ok: false;
  configured: true;
  error: string;
}
export type StkInitResult = StkInitSuccess | StkInitUnconfigured | StkInitError;

export type StkStatus = "PENDING" | "SUCCESS" | "FAILED" | "EXPIRED";

export interface StkStatusResult {
  checkoutRequestId: string;
  status: StkStatus;
  receipt?: string;
  amountUsd: number;
  amountKes: number;
  resultCode?: number;
  resultDesc?: string;
}

/** Kick off a real STK push. Never throws — callers branch on the result so the
 *  demo can fall back gracefully when the server is down or unconfigured. */
export async function initMpesaStk(input: {
  phone: string;
  amountUsd: number;
  accountRef?: string;
}): Promise<StkInitResult> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/stkpush`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(input),
    });
  } catch {
    return { ok: false, configured: true, error: "Network error — payment server unreachable" };
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (res.status === 503 && data?.configured === false) {
    return { ok: false, configured: false, amountKes: Number(data.amountKes ?? 0), kesRate: Number(data.kesRate ?? 129.4) };
  }
  if (!res.ok || !data?.checkoutRequestId) {
    return { ok: false, configured: true, error: (data?.error as string) || `STK push failed (${res.status})` };
  }
  return {
    ok: true,
    checkoutRequestId: String(data.checkoutRequestId),
    amountKes: Number(data.amountKes ?? 0),
    businessShortCode: String(data.businessShortCode ?? ""),
    customerMessage: String(data.customerMessage ?? ""),
    ...(data.transactionType ? { transactionType: String(data.transactionType) } : {}),
    ...(data.accountReference ? { accountReference: String(data.accountReference) } : {}),
  };
}

export async function getMpesaStatus(checkoutRequestId: string): Promise<StkStatusResult | null> {
  try {
    const token = getToken();
    const res = await fetch(`${BASE}/status/${encodeURIComponent(checkoutRequestId)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    return (await res.json()) as StkStatusResult;
  } catch {
    return null;
  }
}
