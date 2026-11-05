/**
 * Safaricom Daraja client for M-Pesa STK Push (Lipa na M-Pesa Online).
 *
 * Uses only Node's built-in fetch — no extra dependencies. Endpoints are the
 * canonical Daraja REST paths, chosen by MPESA_ENV (production vs sandbox).
 *
 * The STK "Password" is base64(BusinessShortCode + Passkey + Timestamp), and the
 * Timestamp format is YYYYMMDDHHmmss in the business's local time (we use UTC —
 * Safaricom only requires the SAME string in the push and the later query).
 */

import { prisma } from "./prisma";
import { decrypt, encrypt } from "./crypto";

/* ------------------------------- config ------------------------------- */

export interface MpesaConfig {
  env: "production" | "sandbox";
  host: string;
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  /** Paybill / head-office shortcode. */
  shortcode: string;
  /** Till number (used for CustomerBuyGoodsOnline). */
  tillNumber: string;
  transactionType: "CustomerBuyGoodsOnline" | "CustomerPayBillOnline";
  callbackUrl: string;
  accountRef: string;
  transactionDesc: string;
  kesRate: number;
}

/**
 * The business short code that goes on the wire as BusinessShortCode (and feeds
 * the STK Password). The paybill / HEAD-OFFICE shortcode is required to act as the
 * head office; if only a till is configured we fall back to the till.
 */
export function businessShortCode(cfg: MpesaConfig): string {
  return cfg.shortcode || cfg.tillNumber;
}

/**
 * The effective Daraja TransactionType. Because we push to the head-office paybill
 * shortcode as BusinessShortCode, the flow is CustomerPayBillOnline whenever the
 * head-office shortcode is set; only a pure-till (no head-office) setup uses
 * CustomerBuyGoodsOnline. This overrides a mismatched MPESA_TRANSACTION_TYPE so the
 * type always agrees with the BusinessShortCode Safaricom sees.
 */
export function stkTransactionType(cfg: MpesaConfig): "CustomerBuyGoodsOnline" | "CustomerPayBillOnline" {
  return cfg.shortcode ? "CustomerPayBillOnline" : "CustomerBuyGoodsOnline";
}

/**
 * The till number is carried as the AccountReference ("Party B") when we're pushing
 * to the head-office paybill. Otherwise fall back to the configured account ref.
 */
export function accountReference(cfg: MpesaConfig, override?: string): string {
  if (override) return override;
  if (cfg.shortcode && cfg.tillNumber) return cfg.tillNumber; // till as Party B under the head office
  return cfg.accountRef;
}

/**
 * Runtime overrides set from the admin "Payment Gateways" console. These take
 * precedence over the environment-derived defaults, so M-Pesa can be reconfigured
 * live (per-request) without redeploying or touching .env. Values that are `""`
 * or left undefined fall back to the env. Cleared on process restart unless the
 * deployment persists them (Prisma Gateway.secretEnc when a DB is connected).
 */
export type MpesaSettingsOverride = Partial<Omit<MpesaConfig, "host">>;
let overrides: MpesaSettingsOverride = {};

export function setMpesaOverrides(next: MpesaSettingsOverride): void {
  overrides = { ...overrides, ...next };
  tokenCache = null; // credentials may have changed — force a fresh OAuth token
}

export function getMpesaOverrides(): MpesaSettingsOverride {
  return { ...overrides };
}

export function clearMpesaOverrides(): void {
  overrides = {};
  tokenCache = null;
}

export function mpesaConfig(): MpesaConfig {
  const env = (process.env.MPESA_ENV ?? "sandbox").toLowerCase() === "production" ? "production" : "sandbox";
  const transactionType =
    (process.env.MPESA_TRANSACTION_TYPE ?? "CustomerBuyGoodsOnline") === "CustomerPayBillOnline"
      ? "CustomerPayBillOnline"
      : "CustomerBuyGoodsOnline";
  const base: MpesaConfig = {
    env,
    host: env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke",
    consumerKey: process.env.MPESA_CONSUMER_KEY?.trim() ?? "",
    consumerSecret: process.env.MPESA_CONSUMER_SECRET?.trim() ?? "",
    passkey: process.env.MPESA_PASSKEY?.trim() ?? "",
    shortcode: process.env.MPESA_SHORTCODE?.trim() ?? "",
    tillNumber: process.env.MPESA_TILL_NUMBER?.trim() ?? "",
    transactionType,
    callbackUrl: process.env.MPESA_CALLBACK_URL?.trim() ?? "",
    accountRef: process.env.MPESA_ACCOUNT_REF?.trim() || "LUXYTRADES",
    transactionDesc: process.env.MPESA_TRANSACTION_DESC?.trim() || "Luxytrades deposit",
    kesRate: Number(process.env.MPESA_KES_RATE ?? 129.4) || 129.4,
  };
  // Layer admin overrides on top; host is derived from the (possibly overridden) env.
  const merged: MpesaConfig = { ...base, ...dropEmpty(overrides) };
  merged.host = merged.env === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  return merged;
}

/** Strip keys whose value is undefined/null/empty so they don't clobber env defaults. */
function dropEmpty<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" && v.trim() === "") continue;
    (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

/* -------------------- DB persistence for admin settings -------------------- */
/**
 * The admin "Payment Gateways" console can reconfigure M-Pesa at runtime. On
 * Vercel's serverless Node runtime, process memory does NOT survive cold starts
 * or fan out across instances, so an in-memory-only override would be lost (and
 * different instances would disagree). We therefore persist the settings blob
 * AES-256-GCM encrypted in Gateway(key="mpesa").secretEnc — the same place crypto
 * gateway secrets live — and fold it back into the in-memory overrides on demand.
 */
const MPESA_GATEWAY_KEY = "mpesa";

/** Decrypt + parse the stored settings blob; null when unset or unreadable. */
function parseMpesaSecret(secretEnc: string | null | undefined): MpesaSettingsOverride | null {
  if (!secretEnc) return null;
  const plain = decrypt(secretEnc);
  if (!plain) return null;
  try {
    const parsed = JSON.parse(plain) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as MpesaSettingsOverride) : null;
  } catch {
    return null;
  }
}

// Short-lived cache so a burst of requests to the same warm instance doesn't hit
// the DB (or re-decrypt) for every mpesaConfig() resolution.
let dbCache: { at: number; override: MpesaSettingsOverride } | null = null;
const DB_TTL_MS = 5_000;

/**
 * Load the admin-persisted M-Pesa settings from Gateway.secretEnc and make them
 * the active overrides, so the following `mpesaConfig()` reflects the DB. Falls
 * back to the current env + in-memory state when the DB is unavailable. Callers
 * that need a guaranteed-fresh config pass `force = true` (bypasses the cache).
 */
export async function loadMpesaOverridesFromDb(force = false): Promise<MpesaSettingsOverride> {
  if (!force && dbCache && Date.now() - dbCache.at < DB_TTL_MS) {
    clearMpesaOverrides();
    setMpesaOverrides(dbCache.override);
    return dbCache.override;
  }
  let override: MpesaSettingsOverride = {};
  try {
    const g = await prisma.gateway.findUnique({ where: { key: MPESA_GATEWAY_KEY } });
    const blob = parseMpesaSecret(g?.secretEnc);
    if (blob) override = blob;
  } catch {
    /* DB unavailable — keep whatever env + in-memory overrides already hold */
    return overrides;
  }
  dbCache = { at: Date.now(), override };
  clearMpesaOverrides();
  setMpesaOverrides(override);
  return override;
}

/**
 * Merge admin-entered M-Pesa settings into the stored blob and persist it
 * encrypted to Gateway.secretEnc, then refresh the active in-memory overrides +
 * cache so this (and any subsequent) request uses them immediately. The gateway
 * row is created on demand if it doesn't exist yet.
 */
export async function saveMpesaSettingsToDb(patch: MpesaSettingsOverride): Promise<MpesaSettingsOverride> {
  const g = await prisma.gateway.findUnique({ where: { key: MPESA_GATEWAY_KEY } });
  const existing = parseMpesaSecret(g?.secretEnc) ?? {};
  const merged: MpesaSettingsOverride = { ...existing, ...patch };
  const secretEnc = encrypt(JSON.stringify(merged));
  await prisma.gateway.upsert({
    where: { key: MPESA_GATEWAY_KEY },
    create: {
      key: MPESA_GATEWAY_KEY,
      kind: "MPESA_DARAJA",
      label: "M-Pesa (Daraja)",
      secretEnc,
    },
    update: { secretEnc },
  });
  dbCache = { at: Date.now(), override: merged };
  clearMpesaOverrides();
  setMpesaOverrides(merged);
  return merged;
}

/** True when enough credentials are present to attempt a real Daraja call.
 *  The head-office paybill shortcode is REQUIRED (it acts as BusinessShortCode). */
export function isMpesaConfigured(cfg = mpesaConfig()): boolean {
  return Boolean(
    cfg.consumerKey && cfg.consumerSecret && cfg.passkey && cfg.shortcode && cfg.callbackUrl,
  );
}

/* ------------------------------- helpers ------------------------------- */

/** Daraja Timestamp: YYYYMMDDHHmmss. */
function darajaTimestamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    String(d.getUTCFullYear()) +
    p(d.getUTCMonth() + 1) +
    p(d.getUTCDate()) +
    p(d.getUTCHours()) +
    p(d.getUTCMinutes()) +
    p(d.getUTCSeconds())
  );
}

function stkPassword(cfg: MpesaConfig, timestamp: string): string {
  return Buffer.from(`${businessShortCode(cfg)}${cfg.passkey}${timestamp}`).toString("base64");
}

/** Normalise a Kenyan MSISDN to 2547XXXXXXXX. Throws on obviously bad numbers. */
export function normalizeMpesaPhone(input: string): string {
  const digits = (input ?? "").replace(/[^\d]/g, "");
  if (!digits) throw new Error("Missing phone number");
  if (/^2547\d{8}$/.test(digits)) return digits;
  if (/^2541\d{8}$/.test(digits)) return digits; // Safaricom 1xx ranges
  if (/^0(7|1)\d{8}$/.test(digits)) return "254" + digits.slice(1);
  if (/^(7|1)\d{8}$/.test(digits)) return "254" + digits;
  if (/^254\d{9}$/.test(digits)) return digits;
  throw new Error("Invalid Safaricom phone number");
}

/* ---------------------------- OAuth (cached) ---------------------------- */

interface TokenCache {
  token: string;
  /** ms epoch after which the token is stale. */
  expiresAt: number;
}
let tokenCache: TokenCache | null = null;

export class MpesaUpstreamError extends Error {
  status: number;
  payload: unknown;
  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "MpesaUpstreamError";
    this.status = status;
    this.payload = payload;
  }
}

/** Fetch a Daraja OAuth token, caching it until ~60s before expiry. */
export async function getAccessToken(cfg = mpesaConfig()): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt - now > 60_000) return tokenCache.token;

  const basic = Buffer.from(`${cfg.consumerKey}:${cfg.consumerSecret}`).toString("base64");
  const res = await fetch(`${cfg.host}/oauth/v1/generate?grant_type=client_credentials`, {
    method: "GET",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
  });

  const body = await safeJson(res);
  if (!res.ok || !body || typeof body.access_token !== "string") {
    throw new MpesaUpstreamError(
      "Daraja OAuth failed",
      res.status,
      body ?? { error: "empty response — check MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET" },
    );
  }
  const expiresInSec = Number(body.expires_in ?? 3600) || 3600;
  tokenCache = { token: body.access_token, expiresAt: now + expiresInSec * 1000 };
  return tokenCache.token;
}

/* ------------------------------- STK push ------------------------------- */

export interface StkPushInput {
  phone: string; // any Kenyan format; normalised internally
  amountKes: number; // whole KES
  accountRef?: string;
  description?: string;
  /** Optional external id to correlate; defaults to a generated CheckoutRequestID. */
}

export interface StkPushResult {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  RequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export async function stkpush(input: StkPushInput, cfg = mpesaConfig()): Promise<StkPushResult> {
  if (!cfg.shortcode) throw new Error("Head-office paybill shortcode (MPESA_SHORTCODE) is required to initiate STK push");
  const token = await getAccessToken(cfg);
  const timestamp = darajaTimestamp();
  const payload = {
    BusinessShortCode: businessShortCode(cfg),
    Password: stkPassword(cfg, timestamp),
    Timestamp: timestamp,
    TransactionType: stkTransactionType(cfg),
    Amount: Math.round(input.amountKes),
    Party: normalizeMpesaPhone(input.phone),
    CallbackURL: cfg.callbackUrl,
    AccountReference: accountReference(cfg, input.accountRef),
    TransactionDesc: input.description || cfg.transactionDesc,
  };

  const res = await fetch(`${cfg.host}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await safeJson(res);
  if (!body || typeof body.CheckoutRequestID !== "string") {
    throw new MpesaUpstreamError(
      "Daraja STK push failed",
      res.status,
      body ?? { error: "empty STK response" },
    );
  }
  return body as StkPushResult;
}

/* ------------------------------ STK query ------------------------------ */

export interface StkQueryResult {
  ResponseCode: string;
  ResponseDescription: string;
  ResultCode: number;
  ResultDesc: string;
  CheckoutRequestID: string;
  Amount?: number;
  MpesaReceiptNumber?: string;
  PhoneNumber?: string;
  [k: string]: unknown;
}

export async function stkquery(checkoutRequestId: string, cfg = mpesaConfig()): Promise<StkQueryResult> {
  const token = await getAccessToken(cfg);
  const timestamp = darajaTimestamp();
  const payload = {
    BusinessShortCode: businessShortCode(cfg),
    Password: stkPassword(cfg, timestamp),
    Timestamp: timestamp,
    CheckoutRequestID: checkoutRequestId,
  };
  const res = await fetch(`${cfg.host}/mpesa/stkpushquery/v1/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await safeJson(res);
  if (!body || typeof body.ResultCode !== "number") {
    throw new MpesaUpstreamError("Daraja STK query failed", res.status, body ?? { error: "empty query response" });
  }
  return body as StkQueryResult;
}

/* ------------------------------- utils ------------------------------- */

async function safeJson(res: Response): Promise<any> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
