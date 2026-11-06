/** Admin data model — mirrors the Prisma schema (see prisma/schema.prisma).
 *  Kept local (not importing @prisma/client) so the web app builds even when the
 *  server folder isn't installed, and so the mock adapter can stand in for it. */

export type AccountKind = "REAL" | "DEMO";
export type UserStatus = "ACTIVE" | "SUSPENDED" | "BANNED";
export type KycStatus = "NONE" | "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
export type FundType =
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "TRADE_DEBIT"
  | "TRADE_CREDIT"
  | "BONUS"
  | "ADJUSTMENT"
  | "REFERRAL";
export type FundChannel = "MPESA" | "CRYPTO" | "BANK" | "CARD" | "MANUAL";
export type FundStatus =
  | "PENDING"
  | "ACTION_REQUIRED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "COMPLETED"
  | "FAILED";
export type Side = "BUY" | "SELL";
export type PositionStatus = "OPEN" | "WON" | "LOST" | "CLOSED_EARLY" | "CANCELLED";
export type RunStatus = "ACTIVE" | "COMPLETED" | "STOPPED";
export type BotStatus = "IDLE" | "RUNNING" | "DONE" | "STOPPED";
export type Category = "FOREX" | "COMMODITIES" | "INDICES" | "CRYPTO" | "STOCK";
export type GatewayKind = "MPESA_DARAJA" | "CRYPTO_USDT_TRC20" | "CRYPTO_BTC" | "CARD_STRIPE" | "BANK";
export type TicketStatus = "OPEN" | "PENDING" | "RESOLVED" | "CLOSED";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type AdminRole = "SUPER_ADMIN" | "OPS" | "FINANCE" | "SUPPORT" | "READONLY";

export interface User {
  id: string;
  phone: string;
  email?: string;
  fullName: string;
  countryCode: string;
  status: UserStatus;
  kyc: KycStatus;
  referralCode: string;
  referredBy?: string;
  lastLoginAt?: string;
  createdAt: string;
  realBalance: number;
  demoBalance: number;
  /** Forced trade win rate (0-100). When set, this user's trades settle win/lose
   *  at this rate instead of on real price. Absent = real outcomes. */
  winRate?: number;
  /** When true, this user's withdrawal requests settle instantly (skip ops approve + pay). */
  autoPayout?: boolean;
}

export interface Deposit {
  id: string;
  userId: string;
  user: string; // display name
  channel: FundChannel;
  amount: number;
  bonusPct: number;
  credited: number;
  status: FundStatus;
  reference?: string;
  mpesaCode?: string;
  createdAt: string;
}

export interface Withdrawal {
  id: string;
  userId: string;
  user: string;
  channel: FundChannel;
  amount: number;
  fee: number;
  destination: string;
  status: FundStatus;
  opsApproved: boolean;
  createdAt: string;
}

export interface Position {
  id: string;
  userId: string;
  user: string;
  market: string;
  side: Side;
  amount: number;
  entryPrice: number;
  closePrice?: number;
  duration: number;
  status: PositionStatus;
  payout?: number;
  runId?: string;
  bot?: boolean;
  botId?: string;
  openedAt: string;
  expiresAt: string;
}

export interface Run {
  id: string;
  userId: string;
  user: string;
  market: string;
  side: Side;
  amount: number;
  duration: number;
  total: number;
  remaining: number;
  status: RunStatus;
  bot?: boolean;
  botId?: string;
}

export interface Market {
  code: string;
  name: string;
  category: Category;
  digits: number;
  basePrice: number;
  payoutPct: number;
  active: boolean;
}

export interface MpesaSettings {
  env: "production" | "sandbox";
  transactionType: "CustomerBuyGoodsOnline" | "CustomerPayBillOnline";
  /** Paybill / head-office shortcode (used for CustomerPayBillOnline). */
  shortcode: string;
  /** Till number (used for CustomerBuyGoodsOnline). */
  tillNumber: string;
  callbackUrl: string;
  accountRef: string;
  transactionDesc: string;
  /** USD -> KES conversion applied to the STK amount. */
  kesRate: number;
  // Daraja app credentials are never held in plaintext here — only whether they're set.
  consumerKeySet: boolean;
  consumerSecretSet: boolean;
  passkeySet: boolean;
}

export interface CryptoSettings {
  /** Chain / network shown to depositors, e.g. "TRC20", "ERC20", "Bitcoin". */
  network: string;
  /** Receiving wallet address funds are sent to. */
  address: string;
  /** Network confirmations required before a deposit is credited. */
  confirmations: number;
  /** Auto-credit as soon as the watcher detects the transfer, instead of queueing
   *  the deposit for finance review. */
  autoCredit: boolean;
  /** Webhook the chain watcher posts detected transfers to. */
  callbackUrl: string;
  /** Explorer / node API key — held encrypted, only its presence is surfaced here. */
  apiKeySet: boolean;
}

/** Everything the console edits on a crypto gateway: its chain config plus the
 *  amount limits and fees that live on the Gateway row itself. */
export interface CryptoConfig extends CryptoSettings {
  minAmount: number;
  maxAmount: number;
  feePct: number;
  feeFixed: number;
}

export interface Gateway {
  key: string;
  kind: GatewayKind;
  label: string;
  enabled: boolean;
  minAmount: number;
  maxAmount: number;
  feePct: number;
  feeFixed: number;
  masked: string; // masked credentials
  mpesa?: MpesaSettings; // present on the MPESA_DARAJA gateway
  crypto?: CryptoSettings; // present on CRYPTO_* gateways
}

export interface GatewayCallback {
  id: string;
  gateway: string;
  eventType: string;
  reference?: string;
  amount?: number;
  signatureValid: boolean;
  processed: boolean;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  userId: string;
  user: string;
  type: FundType;
  amount: number;
  balanceAfter: number;
  note?: string;
  createdAt: string;
}

export interface KycApplication {
  id: string;
  userId: string;
  user: string;
  docType: string;
  status: KycStatus;
  country: string;
  submittedAt: string;
}

export interface Ticket {
  id: string;
  userId: string;
  user: string;
  subject: string;
  body: string;
  category: string;
  status: TicketStatus;
  priority: Priority;
  createdAt: string;
  messages: { fromAdmin: boolean; body: string; at: string }[];
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  active: boolean;
  lastSeenAt?: string;
}

export interface AuditLog {
  id: string;
  admin: string;
  action: string;
  entity: string;
  entityId: string;
  ip?: string;
  createdAt: string;
}

export interface Session {
  email: string;
  name: string;
  role: AdminRole;
}

/** Platform-wide configuration edited on the Settings page (singleton row). */
export interface PlatformSettings {
  /* Limits */
  minDeposit: number; // USD floor for a deposit
  maxDeposit: number; // USD ceiling for a single deposit
  minWithdrawal: number; // USD floor for a withdrawal
  maxWithdrawal: number; // USD ceiling for a single withdrawal
  dailyWithdrawalCap: number; // USD total a user may withdraw per day
  /* Bonus */
  defaultDepositBonus: number; // % of deposit credited as bonus by default
  maxBonus: number; // USD ceiling on any single bonus
  /* Risk */
  kycRequiredToWithdraw: boolean; // block payouts until KYC is APPROVED
  maxOpenPositionsPerUser: number; // concurrent OPEN positions allowed
  defaultPayoutPct: number; // fallback win payout when a market has none
}

/* ---------------------------------- email ---------------------------------- */

/** Which automatic email a template drives. Each key maps to one transaction
 *  event that fires it without human intervention. */
export type EmailTemplateKey =
  | "WELCOME"
  | "DEPOSIT_CONFIRMED"
  | "DEPOSIT_REJECTED"
  | "WITHDRAWAL_APPROVED"
  | "WITHDRAWAL_PAID"
  | "WITHDRAWAL_REJECTED"
  | "KYC_APPROVED"
  | "KYC_REJECTED"
  | "PASSWORD_RESET";

export type EmailCategory = "Account" | "Money" | "Compliance" | "Security";

/** An editable transactional email. `body` supports {{variable}} placeholders
 *  listed in `variables`; `key` is both the identity and the auto-send trigger. */
export interface EmailTemplate {
  key: EmailTemplateKey;
  name: string;
  description: string; // what triggers it
  category: EmailCategory;
  subject: string;
  body: string;
  variables: string[];
  enabled: boolean;
  updatedAt: string;
}

/** SMTP transport configuration (singleton). The password is never held in plain
 *  text on the client — only whether one is set. */
export interface EmailSettings {
  enabled: boolean; // master switch for automatic emails
  host: string;
  port: number;
  secure: boolean; // true = implicit TLS (465), false = STARTTLS (587)
  username: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  passwordSet: boolean;
}

export type EmailStatus = "SENT" | "FAILED" | "QUEUED";

/** One row of the delivery log — every automatic (or test) email attempt. */
export interface EmailLogEntry {
  id: string;
  to: string;
  template: string;
  subject: string;
  status: EmailStatus;
  error?: string;
  createdAt: string;
}

export interface BotConfig {
  id: string;
  userId: string;
  market: string; // pair display name
  stake: number; // enforced >= BOT_MIN_STAKE
  duration: number; // seconds
  total: number; // trades per batch
  repeat: boolean; // re-arm after a batch completes
  direction: "MOMENTUM"; // v1 auto-direction
  takeProfit: number; // $ cumulative (0 = off)
  stopLoss: number; // $ cumulative (0 = off)
  earlyClose: boolean; // per-trade TP/SL during expiry
  status: BotStatus;
  activeRunId?: string; // current sequential run this batch is driving
  done: number; // trades completed this session
  realized: number; // running P&L this session
  createdAt: string;
  startedAt?: string;
  stoppedAt?: string;
}

export interface Kpis {
  activeUsers: number;
  pendingDepositCount: number;
  pendingDepositValue: number;
  pendingWithdrawalCount: number;
  pendingWithdrawalValue: number;
  openPositions: number;
  netPnlToday: number;
  openTickets: number;
  verifiedPct: number;
  botVolume: number;
  volumeSeries: { label: string; deposits: number; withdrawals: number }[];
}
