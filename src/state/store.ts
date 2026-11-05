import { useSyncExternalStore } from "react";
import { db } from "../admin/data";
import type {
  BotConfig,
  Deposit,
  FundChannel,
  KycStatus,
  LedgerEntry,
  Position,
  Run,
  Side,
  User,
  Withdrawal,
} from "../admin/types";

/**
 * Shared browser store.
 *
 * `db` (declared in ../admin/data.ts) is the SINGLE source of truth for both the
 * trader app and the admin console. This layer adds three things on top of it:
 *   1. persistence to localStorage (survives refresh, seeds the admin queues),
 *   2. a subscription so React re-renders whenever the data changes, and
 *   3. cross-tab sync via the `storage` event so an open /admin tab reflects what
 *      the trader tab does (and vice-versa).
 *
 * The trader operates as the logged-in `SESSION_USER`; every trade, deposit,
 * withdrawal and KYC submission it performs is written into `db` as an admin-shaped
 * record, so it shows up in the back-office queues immediately.
 */

const KEY = "lx_store_v1";

/* ------------------------------ session user ------------------------------ */
// The demo trader maps to the seeded user u1 (Grace Wanjiru).
export const SESSION_USER_ID = "u1";

export function sessionUser(): User {
  const found = db.users.find((u) => u.id === SESSION_USER_ID);
  if (!found) {
    // defensive: recreate the anchor user if persistence ever dropped it
    const anchor: User = {
      id: SESSION_USER_ID,
      phone: "0712345678",
      email: "grace@example.com",
      fullName: "Grace Wanjiru",
      countryCode: "KE",
      status: "ACTIVE",
      kyc: "APPROVED",
      referralCode: "GRACE42",
      createdAt: new Date().toISOString(),
      realBalance: 12450.8,
      demoBalance: 10000,
    };
    db.users = [anchor, ...db.users];
    return anchor;
  }
  return found;
}

/** The forced trade win rate (0-100) an admin pinned for this user, or null when
 *  their trades settle on real price. Read live from the shared db at settle time. */
export function winRateOf(userId: string): number | null {
  const u = db.users.find((x) => x.id === userId);
  return typeof u?.winRate === "number" ? u.winRate : null;
}

/** Payout % for a market (by display name), falling back to the platform default. */
export function payoutPercentFor(pairName: string): number {
  const m = db.markets.find((x) => x.name === pairName);
  return m?.payoutPct ?? db.settings.defaultPayoutPct;
}

/** The M-Pesa gateway as configured in the admin console (shared db). The trader
 *  deposit flow reads the enabled flag + USD→KES rate from here instead of
 *  hardcoding, so gateway config edits take effect immediately. */
export function mpesaGateway() {
  const g = db.gateways.find((x) => x.key === "mpesa");
  return {
    enabled: g?.enabled ?? false,
    settings: g?.mpesa,
    kesRate: g?.mpesa?.kesRate ?? 129.4,
  };
}

/** Crypto gateways as configured in the admin console (shared db). The trader's
 *  crypto deposit/withdraw flows read the receiving address, network and limits
 *  from here so admin edits take effect immediately, mirroring mpesaGateway(). */
export function cryptoGateway() {
  const rows = db.gateways.filter((g) => g.kind.startsWith("CRYPTO_"));
  return {
    /** True once any crypto gateway has a receiving address on file — lets the
     *  trader app tell "never configured" apart from "configured but switched off". */
    hasAny: rows.some((g) => Boolean(g.crypto?.address)),
    assets: rows
      .filter((g) => g.enabled && g.crypto?.address)
      .map((g) => ({
        sym: g.key.toUpperCase(),
        net: g.crypto?.network ?? "",
        addr: g.crypto?.address ?? "",
        min: g.minAmount,
        max: g.maxAmount,
        confirmations: g.crypto?.confirmations ?? 2,
      })),
  };
}

/* ---------------------------- positions with account ---------------------------- */
/**
 * A live position carries the trader's account + price precision, which the
 * back-office Position type doesn't need but the app does. Extra fields are simply
 * ignored by the admin tables, so both views can share one list.
 */
export type LivePosition = Position & { account: "real" | "demo"; digits: number; pnl?: number };
export type LiveRun = Run & { account: "real" | "demo"; activeId: string | null };

/** A bot the trader launched from the app. The admin BotConfig carries the shared
 *  fields; `account` marks it as an app-created record (seeded mock bots omit it,
 *  so they never leak into the live trader view — same trick as LivePosition). */
export type LiveBot = BotConfig & { account: "real" | "demo" };

/** Hard floor: the trading bot refuses to stake anything under this (per plan §4). */
export const BOT_MIN_STAKE = 50;

/* --------------------------------- reactivity -------------------------------- */

let version = 0;
const listeners = new Set<() => void>();
let persistEnabled = true;

function emit() {
  version++;
  if (persistEnabled) persist();
  for (const l of listeners) l();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function getVersion() {
  return version;
}

/** Run a batch of mutations against `db`, then notify + persist once. */
export function mutate(fn: () => void) {
  fn();
  emit();
}

/** React hook — re-renders the component whenever the shared store changes. */
export function useStoreVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion);
}

/* -------------------------------- persistence -------------------------------- */

function snapshot() {
  return {
    users: db.users,
    deposits: db.deposits,
    withdrawals: db.withdrawals,
    positions: db.positions,
    runs: db.runs,
    markets: db.markets,
    gateways: db.gateways,
    callbacks: db.callbacks,
    ledger: db.ledger,
    kyc: db.kyc,
    tickets: db.tickets,
    adminUsers: db.adminUsers,
    audit: db.audit,
    bots: db.bots,
    settings: db.settings,
  };
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot()));
  } catch {
    /* storage full or unavailable (e.g. private mode) — keep running in-memory */
  }
}

function hydrate() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<ReturnType<typeof snapshot>>;
    const target = db as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(parsed)) {
      if (Array.isArray(v)) target[k] = v;
      else if (v && typeof v === "object") {
        const prev = target[k];
        target[k] = prev && typeof prev === "object" ? { ...(prev as object), ...(v as object) } : v;
      }
    }
  } catch {
    /* corrupt payload — ignore and fall back to the in-memory seed */
  }
}

// hydrate once at module load, before any provider mounts
hydrate();

// cross-tab: when another tab writes the store, adopt it and re-render (no re-persist)
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY || !e.newValue) return;
    persistEnabled = false;
    try {
      hydrate();
      version++;
      for (const l of listeners) l();
    } finally {
      persistEnabled = true;
    }
  });
}

/** Clear all persisted data and revert to the in-memory seed (used by a dev reset). */
export function resetStore() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/* ------------------------------ id + time utils ------------------------------ */

let seq = Date.now() % 1_000_000;
const nid = (p: string) => `${p}${(++seq).toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
const nowIso = () => new Date().toISOString();
const pushAudit = (action: string, entity: string, entityId: string) => {
  db.audit = [
    { id: nid("x"), admin: "Trader (app)", action, entity, entityId, ip: "app", createdAt: nowIso() },
    ...db.audit,
  ];
};

/* ------------------------------- trader actions ------------------------------- */
/** These write admin-shaped records into `db` and are consumed by AppStore. */

export function traderDebit(userId: string, account: "real" | "demo", amount: number) {
  const u = db.users.find((x) => x.id === userId);
  if (!u) return;
  if (account === "real") u.realBalance = Math.max(0, u.realBalance - amount);
  else u.demoBalance = Math.max(0, u.demoBalance - amount);
}

export function traderCredit(userId: string, account: "real" | "demo", amount: number) {
  const u = db.users.find((x) => x.id === userId);
  if (!u) return;
  if (account === "real") u.realBalance += amount;
  else u.demoBalance += amount;
}

export function ledgerOf(entry: Omit<LedgerEntry, "id" | "createdAt">) {
  db.ledger = [{ id: nid("l"), createdAt: nowIso(), ...entry }, ...db.ledger];
}

/* granular mutators (callers batch inside mutate() so persistence emits once) */
export function patchPosition(id: string, patch: Partial<LivePosition>) {
  const i = db.positions.findIndex((p) => p.id === id);
  if (i >= 0) db.positions[i] = { ...db.positions[i], ...patch };
}
export function patchRun(id: string, patch: Partial<LiveRun>) {
  const i = db.runs.findIndex((r) => r.id === id);
  if (i >= 0) db.runs[i] = { ...db.runs[i], ...patch };
}
export function dropRun(id: string) {
  db.runs = db.runs.filter((r) => r.id !== id);
}
export function patchBot(id: string, patch: Partial<LiveBot>) {
  const i = db.bots.findIndex((b) => b.id === id);
  if (i >= 0) db.bots[i] = { ...db.bots[i], ...patch };
}

export function newOpenPosition(args: {
  id?: string;
  account: "real" | "demo";
  pair: string;
  side: Side;
  amount: number;
  entry: number;
  digits: number;
  duration: number;
  expiresAt: number;
  runId: string | null;
  bot?: boolean;
  botId?: string;
}): LivePosition {
  const pos: LivePosition = {
    id: args.id ?? nid("p"),
    userId: SESSION_USER_ID,
    user: sessionUser().fullName,
    market: args.pair,
    side: args.side,
    amount: args.amount,
    entryPrice: args.entry,
    duration: args.duration,
    status: "OPEN",
    runId: args.runId ?? undefined,
    bot: args.bot,
    botId: args.botId,
    openedAt: nowIso(),
    expiresAt: new Date(args.expiresAt).toISOString(),
    account: args.account,
    digits: args.digits,
  };
  db.positions = [pos, ...db.positions];
  return pos;
}

export function newRun(args: {
  account: "real" | "demo";
  pair: string;
  side: Side;
  amount: number;
  duration: number;
  total: number;
  remaining: number;
  activeId: string;
}): LiveRun {
  const run: LiveRun = {
    id: nid("r"),
    userId: SESSION_USER_ID,
    user: sessionUser().fullName,
    market: args.pair,
    side: args.side,
    amount: args.amount,
    duration: args.duration,
    total: args.total,
    remaining: args.remaining,
    status: args.total > 1 ? "ACTIVE" : "COMPLETED",
    account: args.account,
    activeId: args.activeId,
  };
  db.runs = [run, ...db.runs];
  return run;
}

/**
 * Create a deposit. M-Pesa is treated as instant (COMPLETED + credited),
 * crypto arrives as PENDING and is only credited when finance approves it in the
 * admin — so it lands in the back-office "pending deposits" queue untouched.
 */
export function submitDeposit(args: { channel: FundChannel; amount: number; bonusPct: number; mpesaCode?: string; reference?: string }) {
  const credited = Math.round(args.amount * (1 + args.bonusPct / 100) * 100) / 100;
  const instant = args.channel === "MPESA";
  const d: Deposit = {
    id: nid("d"),
    userId: SESSION_USER_ID,
    user: sessionUser().fullName,
    channel: args.channel,
    amount: args.amount,
    bonusPct: args.bonusPct,
    credited,
    status: instant ? "COMPLETED" : "PENDING",
    reference: args.reference,
    mpesaCode: args.mpesaCode,
    createdAt: nowIso(),
  };
  db.deposits = [d, ...db.deposits];
  if (instant) {
    traderCredit(SESSION_USER_ID, "real", credited);
    ledgerOf({ userId: SESSION_USER_ID, user: sessionUser().fullName, type: "DEPOSIT", amount: credited, balanceAfter: sessionUser().realBalance, note: `M-Pesa ${args.mpesaCode ?? ""}`.trim() });
    pushAudit("mpesa_deposit", "Deposit", d.id);
  } else {
    pushAudit("crypto_deposit_pending", "Deposit", d.id);
  }
  emit();
  return d;
}

/** Withdrawals debit the real balance up front; admin "pay" finalises, "reject" refunds. */
export function submitWithdrawal(args: { channel: FundChannel; amount: number; fee: number; destination: string }) {
  const u = sessionUser();
  const w: Withdrawal = {
    id: nid("w"),
    userId: SESSION_USER_ID,
    user: u.fullName,
    channel: args.channel,
    amount: args.amount,
    fee: args.fee,
    destination: args.destination,
    status: "PENDING",
    opsApproved: false,
    createdAt: nowIso(),
  };
  db.withdrawals = [w, ...db.withdrawals];
  traderDebit(SESSION_USER_ID, "real", args.amount);
  ledgerOf({ userId: SESSION_USER_ID, user: u.fullName, type: "WITHDRAWAL", amount: -args.amount, balanceAfter: sessionUser().realBalance, note: `${args.channel} withdrawal requested` });
  pushAudit("withdrawal_request", "Withdrawal", w.id);
  emit();
  return w;
}

/** KYC submission — moves the trader to UNDER_REVIEW and adds an admin queue item. */
export function submitKyc(docType: string, country: string) {
  const u = sessionUser();
  u.kyc = "UNDER_REVIEW";
  const id = nid("k");
  db.kyc = [
    { id, userId: SESSION_USER_ID, user: u.fullName, docType, status: "UNDER_REVIEW" as KycStatus, country, submittedAt: nowIso() },
    ...db.kyc,
  ];
  pushAudit("kyc_submit", "User", SESSION_USER_ID);
  emit();
  return id;
}

/* ------------------------------ trade engine ------------------------------- */
/**
 * Higher-level engine actions the AppStore orchestrates. Each encapsulates the
 * money movement + admin-shaped record so every trade the trader places lands in
 * the back office. They call emit() themselves (one atomic event each).
 */

export interface TradeTicket {
  account: "real" | "demo";
  pair: string;
  side: Side;
  amount: number;
  duration: number;
  entry: number;
  digits: number;
}

/** Start a run of `count` sequential trades; opens the first position immediately. */
export function startTrade(t: TradeTicket, count: number): { runId: string; posId: string } {
  const expiresAt = Date.now() + t.duration * 1000;
  const posId = nid("p");
  const run = newRun({
    account: t.account,
    pair: t.pair,
    side: t.side,
    amount: t.amount,
    duration: t.duration,
    total: count,
    remaining: count - 1,
    activeId: posId,
  });
  newOpenPosition({ id: posId, ...t, expiresAt, runId: run.id });
  traderDebit(SESSION_USER_ID, t.account, t.amount);
  ledgerOf({
    userId: SESSION_USER_ID,
    user: sessionUser().fullName,
    type: "TRADE_DEBIT",
    amount: -t.amount,
    balanceAfter: sessionUser()[t.account === "real" ? "realBalance" : "demoBalance"],
    note: `${t.side === "BUY" ? "Buy" : "Sell"} ${t.pair} stake`,
  });
  pushAudit(count > 1 ? "run_start" : "trade_open", "Position", posId);
  emit();
  return { runId: run.id, posId };
}

/** Launch the next trade of an existing sequential run. */
export function advanceTrade(runId: string, t: TradeTicket): string {
  const expiresAt = Date.now() + t.duration * 1000;
  const pos = newOpenPosition({ ...t, expiresAt, runId });
  const run = db.runs.find((r) => r.id === runId) as LiveRun | undefined;
  traderDebit(SESSION_USER_ID, t.account, t.amount);
  ledgerOf({
    userId: SESSION_USER_ID,
    user: sessionUser().fullName,
    type: "TRADE_DEBIT",
    amount: -t.amount,
    balanceAfter: sessionUser()[t.account === "real" ? "realBalance" : "demoBalance"],
    note: `${t.side === "BUY" ? "Buy" : "Sell"} ${t.pair} stake`,
  });
  if (run) patchRun(runId, { remaining: Math.max(0, run.remaining - 1), activeId: pos.id });
  pushAudit("trade_open", "Position", pos.id);
  emit();
  return pos.id;
}

/** Book a finished trade: mark the position WON/LOST, return stake + P&L, ledger it. */
export function settleTrade(args: {
  posId: string;
  account: "real" | "demo";
  pair: string;
  side: Side;
  stake: number;
  value: number;
  closePrice: number;
}) {
  const won = args.value >= 0;
  const payout = Math.max(0, Math.round(args.value * 100) / 100);
  patchPosition(args.posId, {
    status: won ? "WON" : "LOST",
    closePrice: args.closePrice,
    payout,
    pnl: Math.round(args.value * 100) / 100,
  });
  const credit = args.stake + args.value;
  traderCredit(SESSION_USER_ID, args.account, credit);
  ledgerOf({
    userId: SESSION_USER_ID,
    user: sessionUser().fullName,
    type: won ? "TRADE_CREDIT" : "TRADE_DEBIT",
    amount: won ? Math.round(credit * 100) / 100 : -Math.round(Math.abs(args.value) * 100) / 100,
    balanceAfter: sessionUser()[args.account === "real" ? "realBalance" : "demoBalance"],
    note: `${won ? "Won" : "Lost"} ${args.pair} ${args.side === "BUY" ? "Buy" : "Sell"}`,
  });
  pushAudit("trade_settle", "Position", args.posId);
  emit();
}

/** Mark a run COMPLETED (all trades done) or STOPPED (couldn't continue). */
export function finishRun(runId: string, status: "COMPLETED" | "STOPPED") {
  patchRun(runId, { status, remaining: 0 });
  emit();
}

/* --------------------------------- bot engine -------------------------------- */
/**
 * The trading bot is a thin state machine layered on the same settle loop:
 *   createBot → armBot (RUNNING) → startBotTrade() launches ONE momentum trade at
 *   a time; when it expires the AppStore settles it, calls recordBotResult(), then
 *   either re-launches (via startBotTrade) or stops (TP/SL/limit/budget).
 * The store owns the money + admin-shaped records; AppStore owns price + direction.
 */

export function createBot(args: {
  market: string;
  account: "real" | "demo";
  stake: number;
  duration: number;
  total: number;
  repeat: boolean;
  takeProfit: number;
  stopLoss: number;
  earlyClose: boolean;
}): LiveBot {
  // hard $50 floor — the bot can never be armed with less (plan §4.1)
  const stake = Math.max(BOT_MIN_STAKE, Math.round(args.stake));
  const bot: LiveBot = {
    id: nid("b"),
    userId: SESSION_USER_ID,
    market: args.market,
    stake,
    duration: args.duration,
    total: Math.max(1, Math.floor(args.total)),
    repeat: args.repeat,
    direction: "MOMENTUM",
    takeProfit: args.takeProfit,
    stopLoss: args.stopLoss,
    earlyClose: args.earlyClose,
    status: "IDLE",
    done: 0,
    realized: 0,
    createdAt: nowIso(),
    account: args.account,
  };
  db.bots = [bot, ...db.bots];
  pushAudit("bot_create", "Bot", bot.id);
  emit();
  return bot;
}

/** Flip a bot to RUNNING (called right after its first trade is launched). */
export function armBot(botId: string) {
  const bot = db.bots.find((b) => b.id === botId) as LiveBot | undefined;
  patchBot(botId, { status: "RUNNING", startedAt: bot?.startedAt ?? nowIso() });
  pushAudit("bot_arm", "Bot", botId);
  emit();
}

/** Stop a bot from the app side (kill switch mirror). */
export function stopBot(botId: string, status: "DONE" | "STOPPED" = "DONE") {
  patchBot(botId, { status, stoppedAt: nowIso(), activeRunId: undefined });
  pushAudit("bot_stop", "Bot", botId);
  emit();
}

/** Launch a single bot-driven trade; stamps the position so the admin tags it "Auto". */
export function startBotTrade(t: TradeTicket, botId: string): string {
  const expiresAt = Date.now() + t.duration * 1000;
  const pos = newOpenPosition({ ...t, expiresAt, runId: null, bot: true, botId });
  traderDebit(SESSION_USER_ID, t.account, t.amount);
  ledgerOf({
    userId: SESSION_USER_ID,
    user: sessionUser().fullName,
    type: "TRADE_DEBIT",
    amount: -t.amount,
    balanceAfter: sessionUser()[t.account === "real" ? "realBalance" : "demoBalance"],
    note: `Bot ${t.side === "BUY" ? "Buy" : "Sell"} ${t.pair} stake`,
  });
  patchBot(botId, { activeRunId: pos.id });
  pushAudit("bot_trade_open", "Position", pos.id);
  emit();
  return pos.id;
}

/** Book a settled bot trade against the bot's cumulative P&L + trade count. */
export function recordBotResult(botId: string, pnl: number): LiveBot | undefined {
  const bot = db.bots.find((b) => b.id === botId) as LiveBot | undefined;
  if (!bot) return undefined;
  const done = bot.done + 1;
  const realized = Math.round((bot.realized + pnl) * 100) / 100;
  patchBot(botId, { done, realized, activeRunId: undefined });
  emit();
  return { ...bot, done, realized, activeRunId: undefined } as LiveBot;
}

/** Should the bot stop before launching another trade? */
export function botHaltReason(bot: LiveBot): "TP" | "SL" | "LIMIT" | null {
  if (bot.takeProfit > 0 && bot.realized >= bot.takeProfit) return "TP";
  if (bot.stopLoss > 0 && bot.realized <= -bot.stopLoss) return "SL";
  if (bot.done >= bot.total) return "LIMIT";
  return null;
}

/** The bot may place a stake only if it clears the $50 floor and the balance. */
export function botCanTrade(bot: LiveBot): boolean {
  const bal = balances();
  return bot.stake >= BOT_MIN_STAKE && bot.stake <= bal[bot.account];
}

/* --------------------------- derived trader views --------------------------- */
const isLive = (x: unknown) => (x as { account?: unknown }).account !== undefined;

/** App-created bots for the session trader (seeded mock bots are filtered out). */
export function liveBots(): LiveBot[] {
  return db.bots.filter((b) => b.userId === SESSION_USER_ID && isLive(b)) as LiveBot[];
}

/** Bots currently running for the session trader. */
export function activeBots(): LiveBot[] {
  return liveBots().filter((b) => b.status === "RUNNING");
}

/** Open, app-created positions for the session trader. */
export function livePositions(): LivePosition[] {
  return db.positions.filter(
    (p) => p.userId === SESSION_USER_ID && p.status === "OPEN" && isLive(p),
  ) as LivePosition[];
}

/** Active, app-created runs for the session trader. */
export function liveRuns(): LiveRun[] {
  return db.runs.filter(
    (r) => r.userId === SESSION_USER_ID && r.status === "ACTIVE" && (r as LiveRun).activeId !== undefined,
  ) as LiveRun[];
}

/** Settled, app-created trades (most recent first). */
export function settledTrades(): LivePosition[] {
  return db.positions.filter(
    (p) => p.userId === SESSION_USER_ID && ["WON", "LOST", "CLOSED_EARLY"].includes(p.status) && isLive(p),
  ) as LivePosition[];
}

export function balances(): { real: number; demo: number } {
  const u = sessionUser();
  return { real: u.realBalance, demo: u.demoBalance };
}

/** Most-recent ledger entries for the session trader (deposits, stakes, payouts…). */
export function traderLedger(limit = 12): LedgerEntry[] {
  return db.ledger.filter((l) => l.userId === SESSION_USER_ID).slice(0, limit);
}
