import type { Candle, MarketCategory, MarketRow, Trade } from "./types";

export const balance = "$12,450.80";

/* ------------------------------ market universe ----------------------------- */

export const markets: MarketRow[] = [
  { id: "eurusd", f1: "🇪🇺", f2: "🇺🇸", name: "EUR/USD", price: 1.08452, digits: 5, changePct: 0.42, up: true, spark: [18, 16, 17, 14, 15, 12, 13, 10, 11, 8, 9, 6], category: "Forex" },
  { id: "gbpusd", f1: "🇬🇧", f2: "🇺🇸", name: "GBP/USD", price: 1.2712, digits: 5, changePct: 0.21, up: true, spark: [16, 14, 15, 13, 14, 11, 12, 10, 11, 8, 9, 7], category: "Forex" },
  { id: "usdjpy", f1: "🇺🇸", f2: "🇯🇵", name: "USD/JPY", price: 149.52, digits: 3, changePct: -0.12, up: false, spark: [8, 10, 9, 12, 11, 14, 13, 15, 14, 17, 16, 18], category: "Forex" },
  { id: "gbpjpy", f1: "🇬🇧", f2: "🇯🇵", name: "GBP/JPY", price: 190.31, digits: 3, changePct: 0.33, up: true, spark: [17, 15, 16, 13, 14, 12, 13, 10, 11, 9, 10, 7], category: "Forex" },
  { id: "usdchf", f1: "🇺🇸", f2: "🇨🇭", name: "USD/CHF", price: 0.8721, digits: 5, changePct: 0.25, up: true, spark: [15, 13, 14, 12, 13, 11, 12, 9, 10, 8, 9, 6], category: "Forex" },
  { id: "audusd", f1: "🇦🇺", f2: "🇺🇸", name: "AUD/USD", price: 0.6584, digits: 5, changePct: 1.12, up: true, spark: [19, 17, 18, 15, 16, 13, 14, 11, 12, 9, 10, 6], category: "Forex" },
  { id: "usdcad", f1: "🇺🇸", f2: "🇨🇦", name: "USD/CAD", price: 1.3612, digits: 5, changePct: -1.08, up: false, spark: [7, 9, 8, 11, 10, 13, 12, 15, 14, 17, 16, 19], category: "Forex" },
  { id: "xauusd", f1: "🥇", f2: "🇺🇸", name: "XAU/USD", price: 2745.2, digits: 2, changePct: -0.18, up: false, spark: [7, 9, 8, 11, 10, 13, 12, 15, 14, 16, 15, 18], category: "Commodities" },
  { id: "xagusd", f1: "🥈", f2: "🇺🇸", name: "XAG/USD", price: 31.84, digits: 3, changePct: 0.64, up: true, spark: [14, 12, 13, 11, 12, 10, 11, 9, 10, 8, 9, 6], category: "Commodities" },
  { id: "usoil", f1: "🛢️", f2: "🇺🇸", name: "USOIL", price: 71.42, digits: 2, changePct: -0.35, up: false, spark: [9, 11, 10, 13, 12, 15, 14, 16, 15, 17, 16, 18], category: "Commodities" },
  { id: "usp500", f1: "🇺🇸", f2: "📈", name: "US500", price: 5721.4, digits: 1, changePct: 0.58, up: true, spark: [18, 16, 17, 14, 15, 12, 13, 11, 12, 9, 10, 7], category: "Indices" },
  { id: "nas100", f1: "🇺🇸", f2: "💻", name: "NAS100", price: 20312.6, digits: 1, changePct: 0.91, up: true, spark: [16, 14, 15, 12, 13, 10, 11, 9, 10, 7, 8, 5], category: "Indices" },
  { id: "ger40", f1: "🇩🇪", f2: "📈", name: "GER40", price: 19452.8, digits: 1, changePct: -0.22, up: false, spark: [9, 11, 10, 12, 11, 14, 13, 15, 14, 16, 15, 17], category: "Indices" },
  { id: "btcusd", f1: "🟠", f2: "🇺🇸", name: "BTC/USD", price: 71240.0, digits: 1, changePct: 2.14, up: true, spark: [19, 17, 18, 15, 16, 13, 14, 11, 12, 9, 10, 5], category: "Crypto" },
  { id: "ethusd", f1: "🔷", f2: "🇺🇸", name: "ETH/USD", price: 3842.5, digits: 2, changePct: 1.47, up: true, spark: [17, 15, 16, 13, 14, 11, 12, 10, 11, 8, 9, 6], category: "Crypto" },
  { id: "solusd", f1: "🟣", f2: "🇺🇸", name: "SOL/USD", price: 172.34, digits: 2, changePct: -0.86, up: false, spark: [8, 10, 9, 12, 11, 14, 13, 15, 14, 17, 16, 18], category: "Crypto" },
];

export const marketCategories: MarketCategory[] = ["Forex", "Commodities", "Indices", "Crypto"];

export const formatPrice = (row: MarketRow) =>
  row.price.toLocaleString("en-US", { minimumFractionDigits: row.digits, maximumFractionDigits: row.digits });

export const formatChange = (row: MarketRow) =>
  `${row.changePct >= 0 ? "+" : ""}${row.changePct.toFixed(2)}%`;

/* ------------------------------ home pair list ------------------------------ */

export interface HomePair {
  id: string; // market id
  flag: string;
  name: string;
  price: string;
  change: string;
  direction: "up" | "down";
  selected: boolean;
}

export const homePairs: HomePair[] = markets.slice(0, 4).map((m, i) => ({
  id: m.id,
  flag: m.f1,
  name: m.name,
  price: formatPrice(m),
  change: formatChange(m),
  direction: m.up ? "up" : "down",
  selected: i === 0,
}));

/* ---------------------------------- trades ---------------------------------- */

export const trades: Trade[] = [
  {
    id: "t1",
    pair: "EUR/USD",
    side: "Buy",
    lots: "0.10 Lots",
    pnl: "+ $45.20",
    positive: true,
    date: "Jun 1, 09:15",
    closed: true,
  },
  {
    id: "t2",
    pair: "GBP/USD",
    side: "Sell",
    lots: "0.10 Lots",
    pnl: "- $12.50",
    positive: false,
    date: "Jun 1, 08:30",
    closed: true,
  },
];

/* ------------------------- deterministic candle engine ---------------------- */

/**
 * Deterministic candle generation (mulberry32 PRNG) shaped like the
 * screenshot: a choppy intraday uptrend from ~1.0735 to 1.08452 with a
 * higher-volatility stretch around the middle/right and rising volume.
 */
function makeCandles(): Candle[] {
  // mulberry32
  let a = 0x2f5b91;
  const rand = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const count = 58;
  const candles: Candle[] = [];
  let price = 1.0735;

  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    // gentle uptrend + local waves
    const drift = 0.00016 + 0.00022 * Math.sin(t * Math.PI * 1.35);
    const vol = 0.0006 + 0.0009 * Math.max(0, Math.sin(t * Math.PI * 2.2 - 0.4));
    const open = price;
    const close = open + drift / 2 + (rand() - 0.47) * vol;
    const high = Math.max(open, close) + rand() * vol * 0.55;
    const low = Math.min(open, close) - rand() * vol * 0.55;
    const volume = 18 + rand() * 62 + (i > 30 ? rand() * 34 : 0);
    candles.push({ open, high, low, close, volume });
    price = close;
  }

  // converge the final close exactly onto the quoted price
  const last = candles[count - 1];
  const target = 1.08452;
  const delta = target - last.open;
  last.close = target;
  last.high = Math.max(last.high, target);
  last.low = Math.min(last.low, target);
  // nudge previous candle so there is no visual gap
  candles[count - 2].close = last.open = target - delta * 0.05;

  return candles;
}

function makeCandlesFor(m: MarketRow): Candle[] {
  if (m.id === "eurusd") return makeCandles();
  // seed per pair so each pair has its own stable, deterministic shape
  let a = 0;
  for (const ch of m.id) a = (a * 31 + ch.charCodeAt(0)) | 0;
  const base = m.price;
  const range = base * 0.006 * (m.up ? 1 : -1);
  const start = base - range;
  const count = 58;
  const candles: Candle[] = [];
  let price = start;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const drift = (range / count) * (0.6 + 0.8 * Math.sin(t * Math.PI * 1.3));
    const vol = base * 0.0012 * (0.5 + Math.max(0, Math.sin(t * Math.PI * 2.2 - 0.4)));
    const open = price;
    const close = open + drift / count * 4 + (a % 2 === 0 ? 1 : -1) * 0 + (rand() - 0.48) * vol;
    const high = Math.max(open, close) + rand() * vol * 0.55;
    const low = Math.min(open, close) - rand() * vol * 0.55;
    const volume = 18 + rand() * 62 + (i > 30 ? rand() * 34 : 0);
    candles.push({ open, high, low, close, volume });
    price = close;
  }
  const last = candles[count - 1];
  const delta = base - last.open;
  last.close = base;
  last.high = Math.max(last.high, base);
  last.low = Math.min(last.low, base);
  candles[count - 2].close = last.open = base - delta * 0.05;
  return candles;

  function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

const candleCache = new Map<string, Candle[]>();
export const candlesFor = (id: string): Candle[] => {
  const m = markets.find((x) => x.id === id) ?? markets[0];
  let c = candleCache.get(m.id);
  if (!c) {
    c = makeCandlesFor(m);
    candleCache.set(m.id, c);
  }
  return c;
};

export const candles: Candle[] = candlesFor("eurusd");

export const currentPrice = "1.08452";
