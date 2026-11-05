import type { Bot, Market, Position, Prisma, TradeSide } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Server-authoritative trading engine.
 *
 * Everything money- or outcome-related lives here: prices are random-walked in the
 * database, trades are opened/settled against those persisted prices, and runs +
 * bots are advanced. The browser never decides a price, a payout or a balance — it
 * only renders what these functions have already committed.
 */

/** Hard floor: the trading bot refuses to stake anything under this. */
export const BOT_MIN_STAKE = 50;
/** Minimum gap between price ticks (Neon write pacing). */
const TICK_MS = 2_000;
const FALLBACK_PAYOUT_PCT = 85;

let lastTickAt = 0;

/* ------------------------------- pricing ------------------------------- */

/** Random-walk every active market and persist the new price. Rate-limited so a
 *  busy instance doesn't hammer the database; safe to call on every request. */
export async function tickMarkets(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastTickAt < TICK_MS) return;
  lastTickAt = now;
  const markets = await prisma.market.findMany({ where: { active: true } });
  if (markets.length === 0) return;
  await prisma.$transaction(
    markets.map((m) => {
      const p = m.basePrice > 0 ? m.basePrice : 1;
      const vol = p * 0.00035;
      const next = Math.max(p + (Math.random() - 0.5) * 2 * vol, p * 0.5);
      return prisma.market.update({ where: { code: m.code }, data: { prevPrice: p, basePrice: next } });
    }),
  );
}

export type MarketMap = Map<string, Market>; // keyed by display name (e.g. "EUR/USD")

export async function loadMarketMap(): Promise<MarketMap> {
  const rows = await prisma.market.findMany();
  return new Map(rows.map((r) => [r.name, r]));
}

/** v1 bot auto-direction: last tick's slope (up → BUY, down → SELL). */
export function momentumSide(m: Market): TradeSide {
  return m.basePrice >= m.prevPrice ? "BUY" : "SELL";
}

/* ------------------------------ settlement ------------------------------ */

export interface Outcome {
  won: boolean;
  value: number;
}

/**
 * Decide a position's outcome. An admin-pinned win rate overrides the price-based
 * result (a win pays stake × payout%, a loss forfeits the stake); otherwise the
 * real price move decides, exactly as the platform has always settled.
 */
export function computeOutcome(args: {
  side: TradeSide;
  entry: number;
  close: number;
  amount: number;
  winRate: number | null;
  payoutPct: number;
}): Outcome {
  const { side, entry, close, amount, winRate, payoutPct } = args;
  if (winRate !== null && winRate !== undefined) {
    const won = Math.random() * 100 < winRate;
    return { won, value: won ? (amount * payoutPct) / 100 : -amount };
  }
  const move = (close - entry) * (side === "BUY" ? 1 : -1);
  const value = move * amount * 0.9;
  return { won: value >= 0, value };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

async function creditBalance(
  tx: Prisma.TransactionClient,
  userId: string,
  account: string,
  delta: number,
): Promise<number> {
  const field = account === "demo" ? "demoBalance" : "realBalance";
  const u = await tx.user.update({
    where: { id: userId },
    data: { [field]: { increment: delta } },
    select: { realBalance: true, demoBalance: true },
  });
  return account === "demo" ? u.demoBalance : u.realBalance;
}

/** Settle one OPEN position: book WON/LOST, return stake + P&L, ledger it. */
export async function settlePositionRow(
  pos: Position,
  closePrice: number,
  winRate: number | null,
  payoutPct: number,
): Promise<void> {
  const { won, value } = computeOutcome({
    side: pos.side,
    entry: pos.entryPrice,
    close: closePrice,
    amount: pos.amount,
    winRate,
    payoutPct,
  });
  const credit = pos.amount + value;

  await prisma.$transaction(async (tx) => {
    // Guard against double-settlement (two requests racing on the same row).
    const claimed = await tx.position.updateMany({
      where: { id: pos.id, status: "OPEN" },
      data: {
        status: won ? "WON" : "LOST",
        closePrice,
        payout: Math.max(0, round2(value)),
        pnl: round2(value),
      },
    });
    if (claimed.count === 0) return;

    await creditBalance(tx, pos.userId, pos.account, round2(credit));
    const u = await tx.user.findUnique({ where: { id: pos.userId }, select: { fullName: true, realBalance: true, demoBalance: true } });
    const balanceAfter = pos.account === "demo" ? (u?.demoBalance ?? 0) : (u?.realBalance ?? 0);
    await tx.ledgerEntry.create({
      data: {
        userId: pos.userId,
        type: won ? "TRADE_CREDIT" : "TRADE_DEBIT",
        amount: won ? round2(credit) : -round2(Math.abs(value)),
        balanceAfter,
        note: `${won ? "Won" : "Lost"} ${pos.market} ${pos.side === "BUY" ? "Buy" : "Sell"}`,
      },
    });
    await tx.auditLog.create({
      data: { admin: "Engine", action: "trade_settle", entity: "Position", entityId: pos.id, ip: "engine" },
    });
    // Roll the result into the owning bot's cumulative P&L.
    if (pos.bot && pos.botId) {
      const bot = await tx.bot.findUnique({ where: { id: pos.botId }, select: { id: true, done: true, realized: true } });
      if (bot) {
        await tx.bot.update({
          where: { id: bot.id },
          data: { done: bot.done + 1, realized: round2(bot.realized + value), activeId: null },
        });
      }
    }
  });
}

/* ------------------------------ trade opening ----------------------------- */

export interface OpenTradeInput {
  userId: string;
  market: Market;
  account: "real" | "demo";
  side: TradeSide;
  amount: number;
  duration: number;
  runId?: string | null;
  bot?: boolean;
  botId?: string | null;
}

/** Debit the stake and insert an OPEN position inside an existing transaction. */
export async function openPositionTx(
  tx: Prisma.TransactionClient,
  input: OpenTradeInput,
): Promise<Position> {
  const { userId, market, account, side, amount, duration } = input;
  const entry = market.basePrice;
  const expiresAt = new Date(Date.now() + duration * 1000);

  await creditBalance(tx, userId, account, -amount);
  const pos = await tx.position.create({
    data: {
      userId,
      market: market.name,
      side,
      amount,
      entryPrice: entry,
      duration,
      status: "OPEN",
      account,
      digits: market.digits,
      bot: Boolean(input.bot),
      botId: input.botId ?? null,
      runId: input.runId ?? null,
      expiresAt,
    },
  });
  const u = await tx.user.findUnique({ where: { id: userId }, select: { fullName: true, realBalance: true, demoBalance: true } });
  await tx.ledgerEntry.create({
    data: {
      userId,
      type: "TRADE_DEBIT",
      amount: -amount,
      balanceAfter: account === "demo" ? (u?.demoBalance ?? 0) : (u?.realBalance ?? 0),
      note: `${input.bot ? "Bot " : ""}${side === "BUY" ? "Buy" : "Sell"} ${market.name} stake`,
    },
  });
  return pos;
}

/* ------------------------------- the engine ------------------------------- */

/**
 * Bring a user's live state up to date: settle anything that has expired, advance
 * sequential runs, and let running bots fire their next trade. Idempotent, so the
 * client can drive it simply by polling its account state.
 */
export async function runEngine(userId: string): Promise<void> {
  await tickMarkets();
  const markets = await loadMarketMap();
  const settings = await prisma.platformSettings.upsert({ where: { id: "platform" }, create: { id: "platform" }, update: {} });
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { winRate: true, realBalance: true, demoBalance: true } });
  if (!user) return;
  const winRate = typeof user.winRate === "number" ? user.winRate : null;

  const payoutOf = (name: string) => markets.get(name)?.payoutPct ?? settings.defaultPayoutPct ?? FALLBACK_PAYOUT_PCT;

  /* 1) settle expired positions */
  const due = await prisma.position.findMany({
    where: { userId, status: "OPEN", expiresAt: { lte: new Date() } },
  });
  for (const pos of due) {
    const m = markets.get(pos.market);
    const close = m ? m.basePrice : pos.entryPrice;
    await settlePositionRow(pos, close, winRate, payoutOf(pos.market));
  }

  /* 2) advance active runs whose in-flight trade has cleared */
  const openIds = new Set((await prisma.position.findMany({ where: { userId, status: "OPEN" }, select: { id: true } })).map((p) => p.id));
  const runs = await prisma.run.findMany({ where: { userId, status: "ACTIVE" } });
  for (const run of runs) {
    if (run.activeId && openIds.has(run.activeId)) continue; // still in flight
    const m = markets.get(run.market);
    if (!m) {
      await prisma.run.update({ where: { id: run.id }, data: { status: "STOPPED" } });
      continue;
    }
    if (run.remaining > 0) {
      const bal = run.account === "demo" ? user.demoBalance : user.realBalance;
      if (run.amount > bal) {
        await prisma.run.update({ where: { id: run.id }, data: { status: "STOPPED", activeId: null, remaining: 0 } });
        continue;
      }
      await prisma.$transaction(async (tx) => {
        const pos = await openPositionTx(tx, {
          userId,
          market: m,
          account: run.account as "real" | "demo",
          side: run.side,
          amount: run.amount,
          duration: run.duration,
          runId: run.id,
        });
        await tx.run.update({ where: { id: run.id }, data: { remaining: Math.max(0, run.remaining - 1), activeId: pos.id } });
      });
    } else {
      await prisma.run.update({ where: { id: run.id }, data: { status: "COMPLETED", activeId: null } });
    }
  }

  /* 3) drive running bots */
  const bots = await prisma.bot.findMany({ where: { userId, status: "RUNNING" } });
  for (const bot of bots) {
    // optional per-trade early close: realise once the open trade clears TP/SL.
    if (bot.earlyClose && bot.activeId) {
      const pos = await prisma.position.findUnique({ where: { id: bot.activeId } });
      if (pos && pos.status === "OPEN") {
        const m = markets.get(pos.market);
        const live = m ? m.basePrice : pos.entryPrice;
        const value = (live - pos.entryPrice) * (pos.side === "BUY" ? 1 : -1) * pos.amount * 0.9;
        if ((bot.takeProfit > 0 && value >= bot.takeProfit) || (bot.stopLoss > 0 && value <= -bot.stopLoss)) {
          await settlePositionRow(pos, live, winRate, payoutOf(pos.market));
          continue;
        }
      }
    }
    if (bot.activeId && openIds.has(bot.activeId)) continue; // trade still in flight
    const halt = botHaltReason(bot);
    if (halt === "TP" || halt === "SL") {
      await prisma.bot.update({ where: { id: bot.id }, data: { status: "STOPPED", stoppedAt: new Date(), activeId: null } });
      continue;
    }
    if (halt === "LIMIT") {
      if (bot.repeat) {
        await prisma.bot.update({ where: { id: bot.id }, data: { done: 0, activeId: null } });
        continue;
      }
      await prisma.bot.update({ where: { id: bot.id }, data: { status: "DONE", stoppedAt: new Date(), activeId: null } });
      continue;
    }
    const m = markets.get(bot.market);
    const bal = bot.account === "demo" ? user.demoBalance : user.realBalance;
    if (!m || bot.stake < BOT_MIN_STAKE || bot.stake > bal) {
      await prisma.bot.update({ where: { id: bot.id }, data: { status: "STOPPED", stoppedAt: new Date(), activeId: null } });
      continue;
    }
    await prisma.$transaction(async (tx) => {
      const pos = await openPositionTx(tx, {
        userId,
        market: m,
        account: bot.account as "real" | "demo",
        side: momentumSide(m),
        amount: bot.stake,
        duration: bot.duration,
        runId: null,
        bot: true,
        botId: bot.id,
      });
      await tx.bot.update({ where: { id: bot.id }, data: { activeId: pos.id } });
    });
  }
}

/** Should the bot stop before launching another trade? */
export function botHaltReason(bot: Pick<Bot, "takeProfit" | "stopLoss" | "done" | "total" | "realized">): "TP" | "SL" | "LIMIT" | null {
  if (bot.takeProfit > 0 && bot.realized >= bot.takeProfit) return "TP";
  if (bot.stopLoss > 0 && bot.realized <= -bot.stopLoss) return "SL";
  if (bot.done >= bot.total) return "LIMIT";
  return null;
}

/** Settle a single position on demand (manual "close" / early close). */
export async function closeNow(pos: Position, markets: MarketMap): Promise<void> {
  const winRateRow = await prisma.user.findUnique({ where: { id: pos.userId }, select: { winRate: true } });
  const settings = await prisma.platformSettings.upsert({ where: { id: "platform" }, create: { id: "platform" }, update: {} });
  const m = markets.get(pos.market);
  const close = m ? m.basePrice : pos.entryPrice;
  const payout = m?.payoutPct ?? settings.defaultPayoutPct ?? FALLBACK_PAYOUT_PCT;
  await settlePositionRow(pos, close, typeof winRateRow?.winRate === "number" ? winRateRow.winRate : null, payout);
}
