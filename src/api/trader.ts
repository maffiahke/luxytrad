/**
 * Trader API SDK — the single bridge between the client and the server.
 * Every number the UI shows (balances, positions, markets, gateways) comes
 * from the server snapshot; nothing is credited or settled locally.
 */

const TOKEN_KEY = "lx_trader_token";
const BASE = "/api/trader";

/* --------------------------------- token --------------------------------- */

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/* --------------------------------- types --------------------------------- */

export type TradeSide = "BUY" | "SELL";
export type TradeAccount = "real" | "demo";

export interface TraderUser {
  id: string;
  username?: string;
  phone: string;
  email?: string;
  fullName: string;
  countryCode: string;
  status: string;
  kyc: string;
  referralCode: string;
  realBalance: number;
  demoBalance: number;
  createdAt?: string;
}

export interface TraderPosition {
  id: string;
  userId: string;
  market: string;
  side: TradeSide;
  amount: number;
  entryPrice: number;
  closePrice?: number;
  duration: number;
  status: "OPEN" | "WON" | "LOST" | "CLOSED_EARLY";
  payout?: number;
  pnl?: number;
  account: TradeAccount;
  digits: number;
  bot: boolean;
  botId?: string;
  runId?: string;
  openedAt?: string;
  expiresAt?: string;
}

export interface TraderRun {
  id: string;
  userId: string;
  market: string;
  side: TradeSide;
  amount: number;
  duration: number;
  total: number;
  remaining: number;
  status: string;
  account: TradeAccount;
  activeId: string | null;
}

export interface TraderBot {
  id: string;
  userId: string;
  market: string;
  account: TradeAccount;
  stake: number;
  duration: number;
  total: number;
  done: number;
  repeat: boolean;
  direction: "MOMENTUM";
  takeProfit: number;
  stopLoss: number;
  earlyClose: boolean;
  status: "RUNNING" | "STOPPED" | "HALT_TP" | "HALT_SL" | "HALT_LIMIT";
  realized: number;
  activeRunId?: string;
  createdAt?: string;
  startedAt?: string;
  stoppedAt?: string;
}

export interface TraderMarket {
  code: string;
  name: string;
  category: string;
  digits: number;
  price: number;
  payoutPct: number;
  active: boolean;
}

export interface TraderLedgerEntry {
  id: string;
  userId: string;
  type: string;
  amount: number;
  balanceAfter: number;
  note?: string;
  createdAt?: string;
}

export interface MpesaGateway {
  enabled: boolean;
  listed: boolean;
  configured: boolean;
  minAmount: number;
  maxAmount: number;
  feePct: number;
  feeFixed: number;
  kesRate: number;
  shortcode: string;
  requiresPhone: boolean;
}

export interface CryptoAsset {
  key: string;
  sym: string;
  net: string;
  addr: string;
  min: number;
  max: number;
  feePct: number;
  feeFixed: number;
  confirmations: number;
}

export interface TraderGateways {
  mpesa: MpesaGateway;
  crypto: { hasAny: boolean; assets: CryptoAsset[] };
}

export interface TraderSettings {
  minDeposit: number;
  maxDeposit: number;
  minWithdrawal: number;
  maxWithdrawal: number;
  dailyWithdrawalCap: number;
  defaultDepositBonus: number;
  maxBonus: number;
  kycRequiredToWithdraw: boolean;
  maxOpenPositionsPerUser: number;
  defaultPayoutPct: number;
}

/** The full snapshot returned by GET /state and by every mutating action. */
export interface TraderState {
  user: TraderUser;
  settings: TraderSettings;
  markets: TraderMarket[];
  positions: TraderPosition[];
  runs: TraderRun[];
  history: TraderPosition[];
  ledger: TraderLedgerEntry[];
  bots: TraderBot[];
  gateways: TraderGateways;
}

export interface AuthResponse {
  token: string;
  user: TraderUser;
}

/* ------------------------------- transport ------------------------------- */

export class ApiRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function apiFetch<T>(path: string, body?: unknown, method?: string): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    throw new ApiRequestError(res.status, data?.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

/* -------------------------------- endpoints ------------------------------- */

export function register(input: {
  fullName: string;
  username: string;
  phone: string;
  email?: string;
  password: string;
  countryCode?: string;
  referralCode?: string;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/register", input);
}

export function login(identifier: string, password: string): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/login", { identifier, password });
}

export function me(): Promise<{ user: TraderUser }> {
  return apiFetch<{ user: TraderUser }>("/me");
}

export function getState(): Promise<TraderState> {
  return apiFetch<TraderState>("/state");
}

export function getMarkets(): Promise<TraderMarket[]> {
  return apiFetch<TraderMarket[]>("/markets");
}

export interface PlaceTradeInput {
  account: TradeAccount;
  market: string;
  side: TradeSide;
  amount: number;
  duration: number;
  count?: number;
}

export function placeTrade(input: PlaceTradeInput): Promise<TraderState> {
  return apiFetch<TraderState>("/trades", input);
}

export function closeTrade(id: string): Promise<TraderState> {
  return apiFetch<TraderState>(`/trades/${encodeURIComponent(id)}/close`, {});
}

export type DepositChannel = "CRYPTO" | "BANK" | "CARD";

export function deposit(input: {
  channel: DepositChannel;
  amount: number;
  bonusPct?: number;
  reference?: string;
}): Promise<TraderState> {
  return apiFetch<TraderState>("/deposits", input);
}

export type WithdrawChannel = "MPESA" | "CRYPTO" | "BANK";

export function withdraw(input: {
  channel: WithdrawChannel;
  amount: number;
  fee: number;
  destination: string;
}): Promise<{ id: string; state: TraderState }> {
  return apiFetch<{ id: string; state: TraderState }>("/withdrawals", input);
}

export function submitKyc(docType: string, country: string): Promise<TraderState> {
  return apiFetch<TraderState>("/kyc", { docType, country });
}

export interface StartBotInput {
  account: TradeAccount;
  market: string;
  stake: number;
  duration: number;
  total: number;
  repeat: boolean;
  takeProfit: number;
  stopLoss: number;
  earlyClose: boolean;
}

export function startBot(input: StartBotInput): Promise<TraderState> {
  return apiFetch<TraderState>("/bots", input);
}

export function stopBot(id: string): Promise<TraderState> {
  return apiFetch<TraderState>(`/bots/${encodeURIComponent(id)}/stop`, {});
}
