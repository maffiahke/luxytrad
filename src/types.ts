export interface PairQuote {
  id: string;
  flag: string;
  name: string;
  price: string;
  change: string;
  direction: "up" | "down";
  selected: boolean;
}

export interface Trade {
  id: string;
  pair: string;
  side: "Buy" | "Sell";
  lots: string;
  pnl: string;
  positive: boolean;
  date: string;
  closed: boolean;
}

export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface NavItem {
  id: string;
  label: string;
}

export type MarketCategory = "Forex" | "Commodities" | "Indices" | "Crypto";

export interface MarketRow {
  id: string;
  f1: string;
  f2: string;
  name: string;
  price: number;
  digits: number;
  changePct: number;
  up: boolean;
  spark: number[];
  category: MarketCategory;
}
