import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { ApiError, handler } from "../lib/http";
import { hashPassword, verifyPassword } from "../lib/auth";
import { authenticateTrader, signTraderToken } from "../lib/traderAuth";
import { parseCryptoConfig } from "../lib/crypto-gateway";
import { businessShortCode, isMpesaConfigured, loadMpesaOverridesFromDb, mpesaConfig } from "../lib/mpesa";
import {
  BOT_MIN_STAKE,
  loadMarketMap,
  openPositionTx,
  runEngine,
  settlePositionRow,
  tickMarkets,
} from "../lib/engine";

/**
 * The trader-facing API — everything the mobile app needs, all backed by Postgres.
 * Mounted at /api/trader. Auth endpoints are public; the rest require a trader
 * bearer token (see lib/traderAuth.ts).
 */
export const traderRouter = Router();

const round2 = (n: number) => Math.round(n * 100) / 100;
const digitsOf = (s: string) => (s ?? "").replace(/\D/g, "");
const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : undefined);

/* ------------------------------ serializers ------------------------------ */

function traderUser(u: any) {
  return {
    id: u.id,
    username: u.username ?? undefined,
    phone: u.phone,
    email: u.email ?? undefined,
    fullName: u.fullName,
    countryCode: u.countryCode,
    status: u.status,
    kyc: u.kyc,
    referralCode: u.referralCode,
    realBalance: u.realBalance,
    demoBalance: u.demoBalance,
    createdAt: iso(u.createdAt),
  };
}

function traderPosition(p: any) {
  return {
    id: p.id,
    userId: p.userId,
    market: p.market,
    side: p.side,
    amount: p.amount,
    entryPrice: p.entryPrice,
    closePrice: p.closePrice ?? undefined,
    duration: p.duration,
    status: p.status,
    payout: p.payout ?? undefined,
    pnl: p.pnl ?? undefined,
    account: p.account,
    digits: p.digits,
    bot: p.bot,
    botId: p.botId ?? undefined,
    runId: p.runId ?? undefined,
    openedAt: iso(p.openedAt),
    expiresAt: iso(p.expiresAt),
  };
}

function traderRun(r: any) {
  return {
    id: r.id,
    userId: r.userId,
    market: r.market,
    side: r.side,
    amount: r.amount,
    duration: r.duration,
    total: r.total,
    remaining: r.remaining,
    status: r.status,
    account: r.account,
    activeId: r.activeId ?? null,
  };
}

function traderBot(b: any) {
  return {
    id: b.id,
    userId: b.userId,
    market: b.market,
    account: b.account,
    stake: b.stake,
    duration: b.duration,
    total: b.total,
    done: b.done,
    repeat: b.repeat,
    direction: "MOMENTUM",
    takeProfit: b.takeProfit,
    stopLoss: b.stopLoss,
    earlyClose: b.earlyClose,
    status: b.status,
    realized: b.realized,
    activeRunId: b.activeId ?? undefined,
    createdAt: iso(b.createdAt),
    startedAt: iso(b.startedAt),
    stoppedAt: iso(b.stoppedAt),
  };
}

function traderMarket(m: any) {
  return {
    code: m.code,
    name: m.name,
    category: m.category,
    digits: m.digits,
    price: m.basePrice,
    payoutPct: m.payoutPct,
    active: m.active,
  };
}

/** The which-methods-are-on payload the trader uses to build its deposit and
 *  withdrawal screens. A gateway that is toggled off in the console simply
 *  disappears from here. */
async function traderGateways() {
  const rows = await prisma.gateway.findMany();
  const mpesaRow = rows.find((g) => g.kind === "MPESA_DARAJA");
  const cryptoRows = rows.filter((g) => g.kind.startsWith("CRYPTO_"));
  await loadMpesaOverridesFromDb();
  const cfg = mpesaConfig();
  const configured = isMpesaConfigured(cfg);
  return {
    mpesa: {
      enabled: Boolean(mpesaRow?.enabled) && configured,
      listed: Boolean(mpesaRow?.enabled),
      configured,
      minAmount: mpesaRow?.minAmount ?? 0,
      maxAmount: mpesaRow?.maxAmount ?? 0,
      feePct: mpesaRow?.feePct ?? 0,
      feeFixed: mpesaRow?.feeFixed ?? 0,
      kesRate: cfg.kesRate,
      shortcode: businessShortCode(cfg),
      requiresPhone: true,
    },
    crypto: {
      hasAny: cryptoRows.some((g) => Boolean(parseCryptoConfig(g.secretEnc)?.address)),
      assets: cryptoRows
        .filter((g) => g.enabled)
        .map((g) => {
          const c = parseCryptoConfig(g.secretEnc);
          return {
            key: g.key,
            sym: g.key.toUpperCase(),
            net: c?.network ?? "",
            addr: c?.address ?? "",
            min: g.minAmount,
            max: g.maxAmount,
            feePct: g.feePct,
            feeFixed: g.feeFixed,
            confirmations: c?.confirmations ?? 2,
          };
        })
        .filter((a) => a.addr),
    },
  };
}

/** The full account snapshot the app renders from. Runs the engine first so any
 *  expired trade has already been settled server-side before the client sees it. */
async function buildState(userId: string) {
  await runEngine(userId);
  const [user, settings, markets, positions, runs, settled, ledger, bots, gateways] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.platformSettings.upsert({ where: { id: "platform" }, create: { id: "platform" }, update: {} }),
    prisma.market.findMany({ orderBy: { code: "asc" } }),
    prisma.position.findMany({ where: { userId, status: "OPEN" }, orderBy: { openedAt: "desc" } }),
    prisma.run.findMany({ where: { userId, status: "ACTIVE" } }),
    prisma.position.findMany({
      where: { userId, status: { in: ["WON", "LOST", "CLOSED_EARLY"] } },
      orderBy: { openedAt: "desc" },
      take: 100,
    }),
    prisma.ledgerEntry.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.bot.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 }),
    traderGateways(),
  ]);
  if (!user) throw new ApiError(404, "Account not found");
  return {
    user: traderUser(user),
    settings: {
      minDeposit: settings.minDeposit,
      maxDeposit: settings.maxDeposit,
      minWithdrawal: settings.minWithdrawal,
      maxWithdrawal: settings.maxWithdrawal,
      dailyWithdrawalCap: settings.dailyWithdrawalCap,
      defaultDepositBonus: settings.defaultDepositBonus,
      maxBonus: settings.maxBonus,
      kycRequiredToWithdraw: settings.kycRequiredToWithdraw,
      maxOpenPositionsPerUser: settings.maxOpenPositionsPerUser,
      defaultPayoutPct: settings.defaultPayoutPct,
    },
    markets: markets.map(traderMarket),
    positions: positions.map(traderPosition),
    runs: runs.map(traderRun),
    history: settled.map(traderPosition),
    ledger: ledger.map((l) => ({
      id: l.id,
      userId: l.userId,
      type: l.type,
      amount: l.amount,
      balanceAfter: l.balanceAfter,
      note: l.note ?? undefined,
      createdAt: iso(l.createdAt),
    })),
    bots: bots.map(traderBot),
    gateways,
  };
}

/* --------------------------------- auth --------------------------------- */

const registerBody = z.object({
  fullName: z.string().min(2).max(80),
  username: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_.]+$/, "Username may only contain letters, numbers, _ and ."),
  phone: z.string().min(7).max(20),
  email: z.string().trim().email("Enter a valid email address").optional().or(z.literal("")),
  password: z.string().min(6).max(128),
  countryCode: z.string().min(2).max(3).optional(),
  referralCode: z.string().max(24).optional(),
});

traderRouter.post(
  "/auth/register",
  handler(async (req, res) => {
    const body = registerBody.parse(req.body);
    const username = body.username.trim().toLowerCase();
    const phone = digitsOf(body.phone);
    const email = body.email && body.email.trim() ? body.email.trim().toLowerCase() : undefined;
    if (phone.length < 7) throw new ApiError(400, "Enter a valid phone number");

    const [byUser, byPhone, byEmail] = await Promise.all([
      prisma.user.findUnique({ where: { username } }),
      prisma.user.findUnique({ where: { phone } }),
      email ? prisma.user.findFirst({ where: { email } }) : Promise.resolve(null),
    ]);
    if (byUser) throw new ApiError(409, "That username is already taken");
    if (byPhone) throw new ApiError(409, "That phone number is already registered");
    if (byEmail) throw new ApiError(409, "That email address is already registered");

    // Referral code: derived from the username, de-duped with a numeric suffix.
    const base = username.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8) || "TRADER";
    let referralCode = base;
    for (let i = 0; i < 50; i++) {
      const clash = await prisma.user.findUnique({ where: { referralCode } });
      if (!clash) break;
      referralCode = `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const referredBy = body.referralCode
      ? (await prisma.user.findUnique({ where: { referralCode: body.referralCode.trim().toUpperCase() }, select: { id: true } }))?.id
      : undefined;

    const user = await prisma.user.create({
      data: {
        username,
        phone,
        email,
        fullName: body.fullName.trim(),
        countryCode: (body.countryCode ?? "KE").toUpperCase(),
        passwordHash: hashPassword(body.password),
        referralCode,
        referredBy,
        // The demo wallet starts with play money; the real wallet starts at zero and
        // only ever grows from confirmed payments.
        demoBalance: 10_000,
        lastLoginAt: new Date(),
      },
    });
    await prisma.auditLog.create({
      data: { admin: "Trader (app)", action: "register", entity: "User", entityId: user.id, ip: "app" },
    });
    res.status(201).json({ token: signTraderToken(user.id), user: traderUser(user) });
  }),
);

const loginBody = z.object({ identifier: z.string().min(3), password: z.string().min(1) });

traderRouter.post(
  "/auth/login",
  handler(async (req, res) => {
    const { identifier, password } = loginBody.parse(req.body);
    const id = identifier.trim();
    const user =
      (await prisma.user.findUnique({ where: { username: id.toLowerCase() } })) ??
      (await prisma.user.findUnique({ where: { phone: digitsOf(id) } })) ??
      (await prisma.user.findFirst({ where: { email: id.toLowerCase() } }));
    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      throw new ApiError(401, "Invalid username or password");
    }
    if (user.status !== "ACTIVE") throw new ApiError(403, "This account is not active");
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    res.json({ token: signTraderToken(user.id), user: traderUser(user) });
  }),
);

/* --------------------------- authenticated surface --------------------------- */

traderRouter.use(authenticateTrader);

traderRouter.get("/me", handler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.trader!.sub } });
  if (!user) throw new ApiError(404, "Account not found");
  res.json({ user: traderUser(user) });
}));

traderRouter.get("/state", handler(async (req, res) => {
  res.json(await buildState(req.trader!.sub));
}));

traderRouter.get("/markets", handler(async (_req, res) => {
  await tickMarkets();
  const markets = await prisma.market.findMany({ orderBy: { code: "asc" } });
  res.json(markets.map(traderMarket));
}));

/* --------------------------------- trades --------------------------------- */

const tradeBody = z.object({
  account: z.enum(["real", "demo"]).default("real"),
  market: z.string().min(1),
  side: z.enum(["BUY", "SELL"]),
  amount: z.coerce.number().positive(),
  duration: z.coerce.number().int().positive().max(3600),
  count: z.coerce.number().int().positive().max(50).default(1),
});

traderRouter.post(
  "/trades",
  handler(async (req, res) => {
    const userId = req.trader!.sub;
    const body = tradeBody.parse(req.body);
    await tickMarkets();

    const market = await prisma.market.findFirst({ where: { name: body.market, active: true } });
    if (!market) throw new ApiError(400, "That market is not available");
    const settings = await prisma.platformSettings.upsert({ where: { id: "platform" }, create: { id: "platform" }, update: {} });

    const openCount = await prisma.position.count({ where: { userId, status: "OPEN", account: body.account } });
    if (openCount + body.count > settings.maxOpenPositionsPerUser) {
      throw new ApiError(400, `You can hold at most ${settings.maxOpenPositionsPerUser} open positions at once`);
    }

    await prisma.$transaction(async (tx) => {
      const u = await tx.user.findUnique({ where: { id: userId }, select: { realBalance: true, demoBalance: true } });
      if (!u) throw new ApiError(404, "Account not found");
      const bal = body.account === "demo" ? u.demoBalance : u.realBalance;
      if (body.amount > bal) throw new ApiError(400, "Insufficient balance for this trade");

      const run = await tx.run.create({
        data: {
          userId,
          market: market.name,
          side: body.side,
          amount: body.amount,
          duration: body.duration,
          total: body.count,
          remaining: body.count - 1,
          status: body.count > 1 ? "ACTIVE" : "COMPLETED",
          account: body.account,
        },
      });
      const pos = await openPositionTx(tx, {
        userId,
        market,
        account: body.account,
        side: body.side,
        amount: body.amount,
        duration: body.duration,
        runId: run.id,
      });
      await tx.run.update({ where: { id: run.id }, data: { activeId: pos.id } });
      await tx.auditLog.create({
        data: { admin: "Trader (app)", action: body.count > 1 ? "run_start" : "trade_open", entity: "Position", entityId: pos.id, ip: "app" },
      });
    });

    res.status(201).json(await buildState(userId));
  }),
);

traderRouter.post(
  "/trades/:id/close",
  handler(async (req, res) => {
    const userId = req.trader!.sub;
    const pos = await prisma.position.findFirst({ where: { id: req.params.id, userId, status: "OPEN" } });
    if (!pos) throw new ApiError(404, "Open position not found");
    await tickMarkets();
    const markets = await loadMarketMap();
    const m = markets.get(pos.market);
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { winRate: true } });
    const settings = await prisma.platformSettings.upsert({ where: { id: "platform" }, create: { id: "platform" }, update: {} });
    await settlePositionRow(
      pos,
      m ? m.basePrice : pos.entryPrice,
      typeof user?.winRate === "number" ? user.winRate : null,
      m?.payoutPct ?? settings.defaultPayoutPct,
    );
    res.json(await buildState(userId));
  }),
);

/* -------------------------------- deposits -------------------------------- */

const depositBody = z.object({
  channel: z.enum(["CRYPTO", "BANK", "CARD"]),
  amount: z.coerce.number().positive(),
  bonusPct: z.coerce.number().min(0).max(1000).default(0),
  reference: z.string().max(120).optional(),
});

traderRouter.post(
  "/deposits",
  handler(async (req, res) => {
    const userId = req.trader!.sub;
    const body = depositBody.parse(req.body);
    const settings = await prisma.platformSettings.upsert({ where: { id: "platform" }, create: { id: "platform" }, update: {} });
    if (body.amount < settings.minDeposit) throw new ApiError(400, `Minimum deposit is $${settings.minDeposit}`);
    if (body.amount > settings.maxDeposit) throw new ApiError(400, `Maximum deposit is $${settings.maxDeposit}`);

    const bonusPct = Math.min(body.bonusPct, settings.defaultDepositBonus);
    const rawBonus = (body.amount * bonusPct) / 100;
    const bonus = Math.min(rawBonus, settings.maxBonus);
    const credited = round2(body.amount + bonus);

    // Crypto/bank/card deposits arrive PENDING and are credited by finance once the
    // transfer is confirmed — the app never credits itself.
    const d = await prisma.deposit.create({
      data: {
        userId,
        channel: body.channel,
        amount: round2(body.amount),
        bonusPct,
        credited,
        status: "PENDING",
        reference: body.reference,
      },
    });
    await prisma.auditLog.create({
      data: { admin: "Trader (app)", action: `${body.channel.toLowerCase()}_deposit_pending`, entity: "Deposit", entityId: d.id, ip: "app" },
    });
    res.status(201).json(await buildState(userId));
  }),
);

/* ------------------------------- withdrawals ------------------------------ */

const withdrawalBody = z.object({
  channel: z.enum(["MPESA", "CRYPTO", "BANK"]),
  amount: z.coerce.number().positive(),
  fee: z.coerce.number().min(0).default(0),
  destination: z.string().min(3).max(120),
});

traderRouter.post(
  "/withdrawals",
  handler(async (req, res) => {
    const userId = req.trader!.sub;
    const body = withdrawalBody.parse(req.body);
    const settings = await prisma.platformSettings.upsert({ where: { id: "platform" }, create: { id: "platform" }, update: {} });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(404, "Account not found");

    if (settings.kycRequiredToWithdraw && user.kyc !== "APPROVED") {
      throw new ApiError(403, "Identity verification is required before you can withdraw");
    }
    if (body.amount < settings.minWithdrawal) throw new ApiError(400, `Minimum withdrawal is $${settings.minWithdrawal}`);
    if (body.amount > settings.maxWithdrawal) throw new ApiError(400, `Maximum withdrawal is $${settings.maxWithdrawal}`);

    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const today = await prisma.withdrawal.aggregate({
      where: { userId, createdAt: { gte: since }, status: { in: ["PENDING", "APPROVED", "UNDER_REVIEW", "COMPLETED"] } },
      _sum: { amount: true },
    });
    if ((today._sum.amount ?? 0) + body.amount > settings.dailyWithdrawalCap) {
      throw new ApiError(400, `Daily withdrawal limit is $${settings.dailyWithdrawalCap}`);
    }

    const w = await prisma.$transaction(async (tx) => {
      const u = await tx.user.findUnique({ where: { id: userId }, select: { realBalance: true, fullName: true } });
      if (!u) throw new ApiError(404, "Account not found");
      if (body.amount > u.realBalance) throw new ApiError(400, "Insufficient balance for this withdrawal");
      const row = await tx.withdrawal.create({
        data: {
          userId,
          channel: body.channel,
          amount: round2(body.amount),
          fee: round2(body.fee),
          destination: body.destination,
          status: "PENDING",
        },
      });
      const updated = await tx.user.update({ where: { id: userId }, data: { realBalance: { decrement: round2(body.amount) } } });
      await tx.ledgerEntry.create({
        data: {
          userId,
          type: "WITHDRAWAL",
          amount: -round2(body.amount),
          balanceAfter: updated.realBalance,
          note: `${body.channel} withdrawal requested`,
        },
      });
      await tx.auditLog.create({
        data: { admin: "Trader (app)", action: "withdrawal_request", entity: "Withdrawal", entityId: row.id, ip: "app" },
      });
      return row;
    });

    res.status(201).json({ id: w.id, state: await buildState(userId) });
  }),
);

/* ----------------------------------- kyc ---------------------------------- */

const kycBody = z.object({ docType: z.string().min(2).max(40), country: z.string().min(2).max(40) });

traderRouter.post(
  "/kyc",
  handler(async (req, res) => {
    const userId = req.trader!.sub;
    const body = kycBody.parse(req.body);
    await prisma.$transaction([
      prisma.kycApplication.create({
        data: { userId, docType: body.docType, status: "UNDER_REVIEW", country: body.country },
      }),
      prisma.user.update({ where: { id: userId }, data: { kyc: "UNDER_REVIEW" } }),
      prisma.auditLog.create({
        data: { admin: "Trader (app)", action: "kyc_submit", entity: "User", entityId: userId, ip: "app" },
      }),
    ]);
    res.status(201).json(await buildState(userId));
  }),
);

/* ---------------------------------- bots ---------------------------------- */

const botBody = z.object({
  account: z.enum(["real", "demo"]).default("real"),
  market: z.string().min(1),
  stake: z.coerce.number().positive(),
  duration: z.coerce.number().int().positive().max(3600),
  total: z.coerce.number().int().positive().max(500).default(1),
  repeat: z.boolean().default(false),
  takeProfit: z.coerce.number().min(0).default(0),
  stopLoss: z.coerce.number().min(0).default(0),
  earlyClose: z.boolean().default(false),
});

traderRouter.post(
  "/bots",
  handler(async (req, res) => {
    const userId = req.trader!.sub;
    const body = botBody.parse(req.body);
    const market = await prisma.market.findFirst({ where: { name: body.market, active: true } });
    if (!market) throw new ApiError(400, "That market is not available");

    const stake = Math.max(BOT_MIN_STAKE, Math.round(body.stake));
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { realBalance: true, demoBalance: true } });
    const bal = body.account === "demo" ? (user?.demoBalance ?? 0) : (user?.realBalance ?? 0);
    if (stake > bal) throw new ApiError(400, `The ${body.account} account needs at least $${stake} to arm the bot`);

    await prisma.$transaction([
      prisma.bot.create({
        data: {
          userId,
          market: market.name,
          account: body.account,
          stake,
          duration: body.duration,
          total: body.total,
          repeat: body.repeat,
          takeProfit: body.takeProfit,
          stopLoss: body.stopLoss,
          earlyClose: body.earlyClose,
          status: "RUNNING",
          startedAt: new Date(),
        },
      }),
      prisma.auditLog.create({ data: { admin: "Trader (app)", action: "bot_create", entity: "Bot", entityId: userId, ip: "app" } }),
    ]);
    // The engine immediately fires the bot's first momentum trade.
    res.status(201).json(await buildState(userId));
  }),
);

traderRouter.post(
  "/bots/:id/stop",
  handler(async (req, res) => {
    const userId = req.trader!.sub;
    const bot = await prisma.bot.findFirst({ where: { id: req.params.id, userId } });
    if (!bot) throw new ApiError(404, "Bot not found");
    // settle any in-flight trade so the kill switch is clean.
    if (bot.activeId) {
      const pos = await prisma.position.findFirst({ where: { id: bot.activeId, userId, status: "OPEN" } });
      if (pos) {
        await tickMarkets();
        const markets = await loadMarketMap();
        const m = markets.get(pos.market);
        const u = await prisma.user.findUnique({ where: { id: userId }, select: { winRate: true } });
        const settings = await prisma.platformSettings.upsert({ where: { id: "platform" }, create: { id: "platform" }, update: {} });
        await settlePositionRow(
          pos,
          m ? m.basePrice : pos.entryPrice,
          typeof u?.winRate === "number" ? u.winRate : null,
          m?.payoutPct ?? settings.defaultPayoutPct,
        );
      }
    }
    await prisma.bot.update({ where: { id: bot.id }, data: { status: "STOPPED", stoppedAt: new Date(), activeId: null } });
    await prisma.auditLog.create({
      data: { admin: "Trader (app)", action: "bot_stop", entity: "Bot", entityId: bot.id, ip: "app" },
    });
    res.json(await buildState(userId));
  }),
);
