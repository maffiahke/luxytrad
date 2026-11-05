import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { candlesFor, formatChange, formatPrice, markets as staticMarkets } from "../data";
import type { Candle, MarketCategory, MarketRow, Trade } from "../types";
import { useToast } from "../components/Toast";
import type { Side } from "../admin/types";
import * as api from "../api/trader";
import {
  clearToken,
  getToken,
  ApiRequestError,
  type CryptoAsset,
  type TraderBot,
  type TraderGateways,
  type TraderLedgerEntry,
  type TraderPosition,
  type TraderSettings,
  type TraderState,
  type TraderUser,
} from "../api/trader";

export type { CryptoAsset, TraderBot, TraderGateways, TraderLedgerEntry, TraderPosition, TraderSettings, TraderUser };

export interface SelectedPair {
  id: string;
  flag: string;
  name: string;
  price: string;
  change: number;
  changeLabel: string;
  up: boolean;
  digits: number;
}

export type AccountType = "real" | "demo";

export interface AccountMeta {
  id: AccountType;
  label: string;
  tag: string;
}

export const ACCOUNTS: AccountMeta[] = [
  { id: "real", label: "Real account", tag: "Real" },
  { id: "demo", label: "Demo account", tag: "Demo" },
];

export interface OpenPosition {
  id: string;
  account: AccountType;
  pair: string;
  side: "Buy" | "Sell";
  amount: number;
  entry: number;
  digits: number;
  openedAt: string;
  /** trade duration in seconds */
  duration: number;
  /** epoch ms when the trade auto-settles (server-authoritative) */
  expiresAt: number;
  /** id of the sequential run this trade belongs to */
  runId: string;
}

/** a sequential run: trades fire one after another, never simultaneously */
export interface RunState {
  id: string;
  account: AccountType;
  pair: string;
  side: "Buy" | "Sell";
  amount: number;
  duration: number;
  /** trades still to launch after the currently active one */
  remaining: number;
  /** original number of trades requested */
  total: number;
  /** id of the currently open position, or null between trades */
  activeId: string | null;
}

/** config the BotConfigModal hands back when the trader arms a bot */
export interface BotInit {
  market: string;
  stake: number;
  duration: number;
  total: number;
  repeat: boolean;
  takeProfit: number;
  stopLoss: number;
  earlyClose: boolean;
}

/** a bot as the trader home banner renders it — a projection of the server Bot row */
export interface LiveBot {
  id: string;
  account: AccountType;
  market: string;
  stake: number;
  duration: number;
  total: number;
  done: number;
  repeat: boolean;
  takeProfit: number;
  stopLoss: number;
  earlyClose: boolean;
  realized: number;
  status: TraderBot["status"];
}

/** selectable trade expiries, in seconds — from 5s up to 5min */
export const DURATIONS = [5, 15, 30, 60, 120, 300] as const;
export type Duration = (typeof DURATIONS)[number];
export const DEFAULT_DURATION: Duration = 30;

export const formatDuration = (s: number) => (s < 60 ? `${s}s` : `${Math.round(s / 60)}m`);

/** mm:ss countdown from remaining milliseconds (never negative) */
export const formatCountdown = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const sec = (total % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
};

interface AppState {
  /** true until the first server snapshot lands */
  loading: boolean;
  trader: TraderUser | null;
  settings: TraderSettings | null;
  gateways: TraderGateways | null;
  balance: number;
  accounts: Record<AccountType, number>;
  activeAccount: AccountType;
  switchAccount: (a: AccountType) => void;
  positions: OpenPosition[];
  runs: RunState[];
  history: Trade[];
  settled: TraderPosition[];
  ledger: TraderLedgerEntry[];
  pair: SelectedPair;
  candles: Candle[];
  markets: MarketRow[];
  selectPair: (id: string) => void;
  timeframe: Timeframe;
  setTimeframe: (tf: Timeframe) => void;
  placeTrade: (side: "Buy" | "Sell", amount: number, duration: number, count?: number) => Promise<boolean>;
  closePosition: (id: string) => Promise<void>;
  pnlOf: (p: OpenPosition) => { value: number; positive: boolean };
  /** epoch ms, ticks every 500ms so countdowns re-render */
  now: number;
  /* ------------------------------- trading bot ------------------------------- */
  bots: LiveBot[];
  activeBot: LiveBot | null;
  botMinStake: number;
  startBot: (cfg: BotInit) => Promise<boolean>;
  haltBot: (id: string) => Promise<void>;
  /* ------------------------------- funds / kyc ------------------------------ */
  deposit: (input: { channel: api.DepositChannel; amount: number; bonusPct?: number; reference?: string }) => Promise<boolean>;
  withdraw: (input: { channel: api.WithdrawChannel; amount: number; fee: number; destination: string }) => Promise<boolean>;
  submitKyc: (docType: string, country: string) => Promise<boolean>;
  /** re-pull the full account snapshot (called after an M-Pesa STK confirms) */
  refresh: () => Promise<void>;
  logout: () => void;
}

export const TIMEFRAMES = ["1m", "15m", "1H", "4H", "1D"] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

const BOT_MIN_STAKE = 50;

/* ------------------------------ conversions ------------------------------ */
const toWire = (s: "Buy" | "Sell"): Side => (s === "Buy" ? "BUY" : "SELL");
const fromWire = (s: Side): "Buy" | "Sell" => (s === "BUY" ? "Buy" : "Sell");

const CAT_TITLE: Record<string, MarketCategory> = {
  FOREX: "Forex",
  COMMODITIES: "Commodities",
  INDICES: "Indices",
  CRYPTO: "Crypto",
};

/** presentation metadata keyed by the server market display name */
const META_BY_NAME: Record<string, { id: string; f1: string; f2: string }> = Object.fromEntries(
  staticMarkets.map((m) => [m.name, { id: m.id, f1: m.f1, f2: m.f2 }]),
);

const marketId = (name: string, code: string) => META_BY_NAME[name]?.id ?? code.toLowerCase();

function hhmm(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const hh = d.getHours().toString().padStart(2, "0");
  const mm = d.getMinutes().toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

/** map a server position to the trader UI's OpenPosition shape */
function toOpen(p: TraderPosition): OpenPosition {
  return {
    id: p.id,
    account: p.account,
    pair: p.market,
    side: fromWire(p.side),
    amount: p.amount,
    entry: p.entryPrice,
    digits: p.digits,
    openedAt: hhmm(p.openedAt),
    duration: p.duration,
    expiresAt: p.expiresAt ? Date.parse(p.expiresAt) : Date.now() + p.duration * 1000,
    runId: p.runId ?? "",
  };
}

function toBot(b: TraderBot): LiveBot {
  return {
    id: b.id,
    account: b.account,
    market: b.market,
    stake: b.stake,
    duration: b.duration,
    total: b.total,
    done: b.done,
    repeat: b.repeat,
    takeProfit: b.takeProfit,
    stopLoss: b.stopLoss,
    earlyClose: b.earlyClose,
    realized: b.realized,
    status: b.status,
  };
}

/* --------------------------- rolling price store --------------------------- */
/** a per-market live tick fed by the server price poll */
interface Tick {
  price: number;
  /** recent prices (oldest → newest), used for change % and the mini sparkline */
  hist: number[];
}

const AppCtx = createContext<AppState | null>(null);

export function AppProvider({ children, onSignedOut }: { children: ReactNode; onSignedOut: () => void }) {
  const toast = useToast();

  const [snap, setSnap] = useState<TraderState | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeAccount, setActiveAccount] = useState<AccountType>("real");
  const [pairId, setPairId] = useState("eurusd");
  const [timeframe, setTimeframe] = useState<Timeframe>("1m");
  const [now, setNow] = useState(() => Date.now());

  // rolling prices + candle series, fed only by the server market poll
  const [ticks, setTicks] = useState<Record<string, Tick>>({});
  const [candleMap, setCandleMap] = useState<Record<string, Candle[]>>({});
  const tickCount = useRef(0);
  const signedOut = useRef(false);

  const candlesPerScreen = 58;

  /* ------------------------------- state pull ------------------------------ */
  const pullState = useRef<() => Promise<void>>(async () => {});
  pullState.current = async () => {
    try {
      const s = await api.getState();
      setSnap(s);
      setLoading(false);
      // make sure a pair is selected and initialised from the live catalogue
      setPairId((cur) => {
        if (s.markets.some((m) => marketId(m.name, m.code) === cur)) return cur;
        return s.markets.length ? marketId(s.markets[0].name, s.markets[0].code) : cur;
      });
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401 && !signedOut.current) {
        signedOut.current = true;
        clearToken();
        onSignedOut();
        return;
      }
      setLoading(false);
    }
  };

  // initial + periodic account snapshot
  useEffect(() => {
    if (!getToken()) return;
    void pullState.current();
    const iv = setInterval(() => void pullState.current(), 2500);
    return () => clearInterval(iv);
  }, []);

  // 500ms clock so countdowns/progress bars tick smoothly
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(iv);
  }, []);

  /* ------------------------------ price feed ------------------------------ */
  // Server-side random walk in tickMarkets(): each call advances every market's
  // price and returns it. We feed those real prices into the chart + lists.
  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const ms = await api.getMarkets();
        if (cancelled) return;
        tickCount.current += 1;
        const c = tickCount.current;
        setTicks((prev) => {
          const next = { ...prev };
          for (const m of ms) {
            const id = marketId(m.name, m.code);
            const cur = prev[id];
            const hist = cur ? [...cur.hist, m.price].slice(-12) : [m.price];
            next[id] = { price: m.price, hist };
          }
          return next;
        });
        setCandleMap((prev) => {
          const next = { ...prev };
          for (const m of ms) {
            const id = marketId(m.name, m.code);
            if (!next[id]) {
              // seed a full chart from the deterministic shape, anchored at the
              // real server price on its last candle
              const seeded = (staticMarkets.some((s) => s.id === id) ? candlesFor(id) : candlesFor("eurusd")).slice();
              const last = { ...seeded[seeded.length - 1] };
              last.close = m.price;
              last.high = Math.max(last.high, m.price);
              last.low = Math.min(last.low, m.price);
              seeded[seeded.length - 1] = last;
              next[id] = seeded;
              continue;
            }
            if (id !== pairId) continue; // only keep the visible chart alive
            const series = next[id].slice();
            const last = { ...series[series.length - 1] };
            const price = m.price;
            const openNew = c > 0 && c % 6 === 0;
            if (openNew) {
              series.push({
                open: last.close,
                high: Math.max(last.close, price),
                low: Math.min(last.close, price),
                close: price,
                volume: 20 + Math.random() * 40,
              });
              if (series.length > candlesPerScreen) series.shift();
            } else {
              last.close = price;
              last.high = Math.max(last.high, price);
              last.low = Math.min(last.low, price);
              last.volume = Math.min(115, last.volume + Math.random() * 5);
              series[series.length - 1] = last;
            }
            next[id] = series;
          }
          return next;
        });
      } catch {
        /* transient — next poll retries */
      }
    };
    poll();
    const iv = setInterval(poll, 1200);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [pairId]);

  /* ------------------------------- derived ------------------------------- */
  const markets = useMemo<MarketRow[]>(() => {
    if (!snap) return [];
    return snap.markets
      .filter((m) => m.active)
      .map((m) => {
        const id = marketId(m.name, m.code);
        const meta = META_BY_NAME[m.name];
        const tick = ticks[id];
        const price = tick?.price ?? m.price;
        const hist = tick?.hist ?? [price];
        const first = hist[0] || price || 1;
        const changePct = hist.length > 1 ? ((price - first) / first) * 100 : 0;
        return {
          id,
          f1: meta?.f1 ?? "📈",
          f2: meta?.f2 ?? "💱",
          name: m.name,
          price,
          digits: m.digits,
          changePct,
          up: changePct >= 0,
          spark: hist.length > 1 ? hist : hist.concat(hist[0] ?? price),
          category: CAT_TITLE[m.category] ?? "Forex",
        };
      });
  }, [snap, ticks]);

  // freshest markets readable from callbacks that must not resubscribe
  const marketsRef = useRef(markets);
  marketsRef.current = markets;

  const priceByName = (name: string) => marketsRef.current.find((x) => x.name === name)?.price ?? 0;

  const marketRow = useMemo<MarketRow>(
    () => markets.find((m) => m.id === pairId) ?? markets[0],
    [markets, pairId],
  );

  const pair = useMemo<SelectedPair>(() => {
    const m = marketRow;
    if (!m) {
      return { id: pairId, flag: "📈", name: "—", price: "0", change: 0, changeLabel: "0.00%", up: true, digits: 5 };
    }
    return {
      id: m.id,
      flag: m.f1,
      name: m.name,
      price: formatPrice(m),
      change: m.changePct,
      changeLabel: formatChange(m),
      up: m.up,
      digits: m.digits,
    };
  }, [marketRow, pairId]);

  const candles = (pairId && candleMap[pairId]) || candleMap[markets[0]?.id ?? ""] || [];

  const accounts = useMemo<Record<AccountType, number>>(
    () => ({ real: snap?.user.realBalance ?? 0, demo: snap?.user.demoBalance ?? 0 }),
    [snap],
  );
  const balance = accounts[activeAccount];

  const positions = useMemo<OpenPosition[]>(
    () => (snap ? snap.positions.filter((p) => p.account === activeAccount).map(toOpen) : []),
    [snap, activeAccount],
  );

  const runs = useMemo<RunState[]>(
    () =>
      (snap?.runs ?? []).map((r) => ({
        id: r.id,
        account: r.account,
        pair: r.market,
        side: fromWire(r.side),
        amount: r.amount,
        duration: r.duration,
        remaining: r.remaining,
        total: r.total,
        activeId: r.activeId,
      })),
    [snap],
  );

  const settled = useMemo<TraderPosition[]>(() => snap?.history ?? [], [snap]);

  const history = useMemo<Trade[]>(
    () =>
      settled.map((p) => {
        const value = p.pnl ?? 0;
        const positive = value >= 0;
        return {
          id: p.id,
          pair: p.market,
          side: fromWire(p.side),
          lots: `$${p.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} Trade`,
          pnl: `${positive ? "+" : "-"} $${Math.abs(value).toFixed(2)}`,
          positive,
          date: hhmm(p.openedAt),
          closed: true,
        };
      }),
    [settled],
  );

  const ledger = useMemo<TraderLedgerEntry[]>(() => snap?.ledger ?? [], [snap]);

  const bots = useMemo<LiveBot[]>(() => (snap ? snap.bots.map(toBot) : []), [snap]);
  const activeBot = useMemo<LiveBot | null>(() => bots.find((b) => b.status === "RUNNING") ?? null, [bots]);

  const pnlOf = (p: OpenPosition) => {
    const live = priceByName(p.pair);
    const move = (live - p.entry) * (p.side === "Buy" ? 1 : -1);
    const value = move * p.amount * 0.9; // indicative only — settlement happens on the server
    return { value, positive: value >= 0 };
  };

  const fail = (title: string, err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    toast.error(title, msg);
  };

  /* -------------------------------- actions -------------------------------- */
  const switchAccount = (a: AccountType) => setActiveAccount(a);
  const selectPair = (id: string) => setPairId(id);

  const placeTrade = async (side: "Buy" | "Sell", amount: number, duration: number, count = 1): Promise<boolean> => {
    if (!Number.isFinite(amount) || amount <= 0) return false;
    const n = Math.max(1, Math.floor(Number.isFinite(count) ? count : 1));
    if (!marketRow) return false;
    if (amount * n > balance) {
      toast.error("Insufficient balance", `Need $${(amount * n).toLocaleString("en-US")} on your ${activeAccount} account.`);
      return false;
    }
    const dur = Number.isFinite(duration) && duration > 0 ? duration : DEFAULT_DURATION;
    try {
      const s = await api.placeTrade({
        account: activeAccount,
        market: marketRow.name,
        side: toWire(side),
        amount,
        duration: dur,
        count: n,
      });
      setSnap(s);
      if (n > 1) toast.info("Run started", `${n} × ${side} ${marketRow.name} · $${amount.toLocaleString("en-US")} each.`);
      else toast.success("Trade placed", `${side} ${marketRow.name} · $${amount.toLocaleString("en-US")} · ${formatDuration(dur)}`);
      return true;
    } catch (err) {
      fail("Trade failed", err);
      return false;
    }
  };

  const closePosition = async (id: string) => {
    try {
      const s = await api.closeTrade(id);
      setSnap(s);
      toast.info("Position closed", "The trade was settled by the server.");
    } catch (err) {
      fail("Could not close", err);
    }
  };

  const startBot = async (cfg: BotInit): Promise<boolean> => {
    const stake = Math.max(BOT_MIN_STAKE, Math.round(cfg.stake) || 0);
    if (!markets.some((m) => m.name === cfg.market)) {
      toast.error("Unknown market", "Pick a valid market for the bot.");
      return false;
    }
    if (stake < BOT_MIN_STAKE) {
      toast.error("Minimum stake is $50", "The trading bot only runs with $50 or more per trade.");
      return false;
    }
    try {
      const s = await api.startBot({
        account: activeAccount,
        market: cfg.market,
        stake,
        duration: cfg.duration,
        total: Math.max(1, Math.floor(cfg.total) || 1),
        repeat: cfg.repeat,
        takeProfit: cfg.takeProfit,
        stopLoss: cfg.stopLoss,
        earlyClose: cfg.earlyClose,
      });
      setSnap(s);
      toast.success("Bot activated", `Auto-trading ${cfg.market} · $${stake} · ${formatDuration(cfg.duration)} × ${cfg.total}.`);
      return true;
    } catch (err) {
      fail("Could not start bot", err);
      return false;
    }
  };

  const haltBot = async (id: string) => {
    try {
      const s = await api.stopBot(id);
      setSnap(s);
      toast.info("Bot stopped", "The trading bot was halted.");
    } catch (err) {
      fail("Could not stop bot", err);
    }
  };

  const deposit: AppState["deposit"] = async (input) => {
    try {
      const s = await api.deposit(input);
      setSnap(s);
      return true;
    } catch (err) {
      fail("Deposit failed", err);
      return false;
    }
  };

  const withdraw: AppState["withdraw"] = async (input) => {
    try {
      const res = await api.withdraw(input);
      setSnap(res.state);
      return true;
    } catch (err) {
      fail("Withdrawal failed", err);
      return false;
    }
  };

  const submitKyc = async (docType: string, country: string) => {
    try {
      const s = await api.submitKyc(docType, country);
      setSnap(s);
      toast.success("Submitted for review", "Our team reviews documents within 24 hours.");
      return true;
    } catch (err) {
      fail("Could not submit KYC", err);
      return false;
    }
  };

  const refresh = async () => {
    await pullState.current();
  };

  const logout = () => {
    signedOut.current = true;
    clearToken();
    onSignedOut();
  };

  const value = useMemo<AppState>(
    () => ({
      loading,
      trader: snap?.user ?? null,
      settings: snap?.settings ?? null,
      gateways: snap?.gateways ?? null,
      balance,
      accounts,
      activeAccount,
      switchAccount,
      positions,
      runs,
      history,
      settled,
      ledger,
      pair,
      candles,
      markets,
      selectPair,
      timeframe,
      setTimeframe,
      placeTrade,
      closePosition,
      pnlOf,
      now,
      bots,
      activeBot,
      botMinStake: BOT_MIN_STAKE,
      startBot,
      haltBot,
      deposit,
      withdraw,
      submitKyc,
      refresh,
      logout,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      loading, snap, balance, accounts, activeAccount, positions, runs, history, settled, ledger,
      pair, candles, markets, timeframe, now, bots, activeBot,
    ],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
