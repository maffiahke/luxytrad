import type {
  AdminUser,
  AuditLog,
  BotConfig,
  CryptoConfig,
  Deposit,
  EmailLogEntry,
  EmailSettings,
  EmailTemplate,
  Gateway,
  GatewayCallback,
  KycApplication,
  Kpis,
  LedgerEntry,
  Market,
  MpesaSettings,
  PlatformSettings,
  Position,
  Run,
  Ticket,
  User,
  Withdrawal,
} from "./types";

/* ---------------------------------- seed ---------------------------------- */

const daysAgo = (n: number, h = 9) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, (n * 13) % 60, 0, 0);
  return d.toISOString();
};

const users: User[] = [
  { id: "u1", fullName: "Grace Wanjiru", phone: "0712345678", email: "grace@example.com", countryCode: "KE", status: "ACTIVE", kyc: "APPROVED", referralCode: "GRACE42", realBalance: 12450.8, demoBalance: 10000, createdAt: daysAgo(120), lastLoginAt: daysAgo(0, 8) },
  { id: "u2", fullName: "Brian Otieno", phone: "0723456789", email: "brian@example.com", countryCode: "KE", status: "ACTIVE", kyc: "UNDER_REVIEW", referralCode: "BRIAN7", referredBy: "GRACE42", realBalance: 3200, demoBalance: 10000, winRate: 65, createdAt: daysAgo(64), lastLoginAt: daysAgo(1, 19) },
  { id: "u3", fullName: "Amina Hassan", phone: "0734567890", email: "amina@example.com", countryCode: "KE", status: "SUSPENDED", kyc: "PENDING", referralCode: "AMINA9", realBalance: 890.5, demoBalance: 5000, createdAt: daysAgo(40), lastLoginAt: daysAgo(3, 14) },
  { id: "u4", fullName: "Kevin Mwangi", phone: "0745678901", countryCode: "KE", status: "ACTIVE", kyc: "APPROVED", referralCode: "KEV55", referredBy: "GRACE42", realBalance: 15600, demoBalance: 10000, winRate: 80, createdAt: daysAgo(30), lastLoginAt: daysAgo(0, 7) },
  { id: "u5", fullName: "Sarah Njeri", phone: "0756789012", email: "sarah@example.com", countryCode: "KE", status: "BANNED", kyc: "REJECTED", referralCode: "SARA3", realBalance: 0, demoBalance: 2000, createdAt: daysAgo(22), lastLoginAt: daysAgo(10, 12) },
  { id: "u6", fullName: "David Kim", phone: "+1 415 555 0148", email: "david@us.example", countryCode: "US", status: "ACTIVE", kyc: "NONE", referralCode: "DAVID1", realBalance: 240, demoBalance: 10000, createdAt: daysAgo(5), lastLoginAt: daysAgo(0, 6) },
  { id: "u7", fullName: "Fatuma Ali", phone: "0767890123", countryCode: "KE", status: "ACTIVE", kyc: "APPROVED", referralCode: "FATU8", referredBy: "BRIAN7", realBalance: 5400, demoBalance: 10000, winRate: 40, createdAt: daysAgo(18), lastLoginAt: daysAgo(1, 10) },
  { id: "u8", fullName: "Peter Nkosi", phone: "+27 82 555 0111", email: "peter@za.example", countryCode: "ZA", status: "ACTIVE", kyc: "UNDER_REVIEW", referralCode: "PETE2", realBalance: 8700, demoBalance: 10000, createdAt: daysAgo(9), lastLoginAt: daysAgo(0, 5) },
];

const deposits: Deposit[] = [
  { id: "d1", userId: "u2", user: "Brian Otieno", channel: "MPESA", amount: 200, bonusPct: 100, credited: 400, status: "PENDING", reference: "QGH1X8K2LM", mpesaCode: "QGH1X8K2LM", createdAt: daysAgo(0, 7) },
  { id: "d2", userId: "u4", user: "Kevin Mwangi", channel: "CRYPTO", amount: 1000, bonusPct: 0, credited: 1000, status: "ACTION_REQUIRED", reference: "0x9a2f…c17b", createdAt: daysAgo(0, 6) },
  { id: "d3", userId: "u7", user: "Fatuma Ali", channel: "MPESA", amount: 500, bonusPct: 50, credited: 750, status: "PENDING", mpesaCode: "PP2K7LMQ9Z", createdAt: daysAgo(1, 20) },
  { id: "d4", userId: "u1", user: "Grace Wanjiru", channel: "MPESA", amount: 300, bonusPct: 100, credited: 600, status: "COMPLETED", mpesaCode: "RT4M2NQXK0", createdAt: daysAgo(2, 11) },
  { id: "d5", userId: "u8", user: "Peter Nkosi", channel: "CRYPTO", amount: 2500, bonusPct: 0, credited: 2500, status: "APPROVED", reference: "tx_8b1c…ff20", createdAt: daysAgo(1, 15) },
  { id: "d6", userId: "u3", user: "Amina Hassan", channel: "MPESA", amount: 100, bonusPct: 0, credited: 100, status: "REJECTED", mpesaCode: "ZZ0BADCODE", createdAt: daysAgo(4, 9) },
];

const withdrawals: Withdrawal[] = [
  { id: "w1", userId: "u1", user: "Grace Wanjiru", channel: "MPESA", amount: 800, fee: 5, destination: "0712345678", status: "PENDING", opsApproved: false, createdAt: daysAgo(0, 8) },
  { id: "w2", userId: "u4", user: "Kevin Mwangi", channel: "CRYPTO", amount: 1500, fee: 12, destination: "TQn9…Xk4", status: "UNDER_REVIEW", opsApproved: true, createdAt: daysAgo(0, 6) },
  { id: "w3", userId: "u7", user: "Fatuma Ali", channel: "MPESA", amount: 400, fee: 3, destination: "0767890123", status: "PENDING", opsApproved: false, createdAt: daysAgo(1, 18) },
  { id: "w4", userId: "u8", user: "Peter Nkosi", channel: "CRYPTO", amount: 900, fee: 10, destination: "TQa1…Zc9", status: "COMPLETED", opsApproved: true, createdAt: daysAgo(3, 12) },
];

const positions: Position[] = [
  { id: "p1", userId: "u1", user: "Grace Wanjiru", market: "EUR/USD", side: "BUY", amount: 100, entryPrice: 1.08452, duration: 30, status: "OPEN", openedAt: daysAgo(0, 8), expiresAt: new Date(Date.now() + 18000).toISOString() },
  { id: "p2", userId: "u4", user: "Kevin Mwangi", market: "BTC/USD", side: "SELL", amount: 250, entryPrice: 71240.0, closePrice: 70980.0, duration: 60, status: "WON", payout: 205, openedAt: daysAgo(0, 7), expiresAt: daysAgo(0, 7) },
  { id: "p3", userId: "u7", user: "Fatuma Ali", market: "GBP/JPY", side: "BUY", amount: 50, entryPrice: 190.31, closePrice: 189.9, duration: 30, status: "LOST", payout: 0, openedAt: daysAgo(0, 6), expiresAt: daysAgo(0, 6) },
  { id: "p4", userId: "u2", user: "Brian Otieno", market: "XAU/USD", side: "BUY", amount: 200, entryPrice: 2745.2, closePrice: 2760.0, duration: 120, status: "WON", payout: 360, openedAt: daysAgo(0, 5), expiresAt: daysAgo(0, 5) },
  { id: "p5", userId: "u8", user: "Peter Nkosi", market: "US500", side: "SELL", amount: 150, entryPrice: 5721.4, closePrice: 5730.1, duration: 300, status: "LOST", payout: 0, openedAt: daysAgo(0, 4), expiresAt: daysAgo(0, 4) },
];

const runs: Run[] = [
  { id: "r1", userId: "u1", user: "Grace Wanjiru", market: "EUR/USD", side: "BUY", amount: 100, duration: 30, total: 5, remaining: 2, status: "ACTIVE" },
  { id: "r2", userId: "u4", user: "Kevin Mwangi", market: "BTC/USD", side: "SELL", amount: 250, duration: 60, total: 3, remaining: 0, status: "COMPLETED" },
  { id: "r3", userId: "u7", user: "Fatuma Ali", market: "GBP/JPY", side: "BUY", amount: 50, duration: 15, total: 4, remaining: 1, status: "STOPPED" },
];

const bots: BotConfig[] = [
  { id: "b1", userId: "u4", market: "BTC/USD", stake: 250, duration: 60, total: 20, repeat: true, direction: "MOMENTUM", takeProfit: 500, stopLoss: 300, earlyClose: false, status: "RUNNING", done: 8, realized: 210, createdAt: daysAgo(1, 6), startedAt: daysAgo(1, 6) },
  { id: "b2", userId: "u1", market: "EUR/USD", stake: 100, duration: 30, total: 10, repeat: false, direction: "MOMENTUM", takeProfit: 150, stopLoss: 80, earlyClose: true, status: "DONE", done: 10, realized: 152, createdAt: daysAgo(2, 9), startedAt: daysAgo(2, 9), stoppedAt: daysAgo(2, 10) },
];

const markets: Market[] = [
  { code: "EURUSD", name: "EUR/USD", category: "FOREX", digits: 5, basePrice: 1.08452, payoutPct: 87, active: true },
  { code: "GBPUSD", name: "GBP/USD", category: "FOREX", digits: 5, basePrice: 1.2712, payoutPct: 85, active: true },
  { code: "USDJPY", name: "USD/JPY", category: "FOREX", digits: 3, basePrice: 149.52, payoutPct: 86, active: true },
  { code: "XAUUSD", name: "XAU/USD", category: "COMMODITIES", digits: 2, basePrice: 2745.2, payoutPct: 80, active: true },
  { code: "US500", name: "US500", category: "INDICES", digits: 1, basePrice: 5721.4, payoutPct: 90, active: true },
  { code: "BTCUSD", name: "BTC/USD", category: "CRYPTO", digits: 1, basePrice: 71240.0, payoutPct: 82, active: true },
  { code: "ETHUSD", name: "ETH/USD", category: "CRYPTO", digits: 2, basePrice: 3842.5, payoutPct: 82, active: false },
];

const gateways: Gateway[] = [
  {
    key: "mpesa",
    kind: "MPESA_DARAJA",
    label: "M-Pesa (Safaricom)",
    enabled: true,
    minAmount: 5,
    maxAmount: 5000,
    feePct: 0,
    feeFixed: 0,
    masked: "key ••••3f9a",
    mpesa: {
      env: "production",
      transactionType: "CustomerPayBillOnline",
      shortcode: "",
      tillNumber: "",
      callbackUrl: "https://yourdomain.com/api/payments/mpesa/callback",
      accountRef: "LUXYTRADES",
      transactionDesc: "Luxytrades deposit",
      kesRate: 129.4,
      consumerKeySet: false,
      consumerSecretSet: false,
      passkeySet: false,
    },
  },
  { key: "usdt", kind: "CRYPTO_USDT_TRC20", label: "USDT · TRC20", enabled: true, minAmount: 20, maxAmount: 100000, feePct: 1, feeFixed: 1, masked: "addr TQn…Xk4", crypto: { network: "TRC20", address: "TQ8k9mYv2Lx4Rr7Np3Wc5Hd1Fz6Gb0JqAv", confirmations: 2, autoCredit: true, callbackUrl: "https://yourdomain.com/api/payments/crypto/callback", apiKeySet: false } },
  { key: "btc", kind: "CRYPTO_BTC", label: "Bitcoin", enabled: false, minAmount: 50, maxAmount: 50000, feePct: 0.5, feeFixed: 2, masked: "xpub ••••", crypto: { network: "Bitcoin", address: "bc1q9z7xk4mfvl0rrn2w8yp36hc5djg1sq0rbeam", confirmations: 2, autoCredit: false, callbackUrl: "https://yourdomain.com/api/payments/crypto/callback", apiKeySet: false } },
  { key: "stripe", kind: "CARD_STRIPE", label: "Card (Stripe)", enabled: false, minAmount: 10, maxAmount: 10000, feePct: 2.9, feeFixed: 0.3, masked: "sk_live_••••8k2" },
];

const callbacks: GatewayCallback[] = [
  { id: "c1", gateway: "M-Pesa", eventType: "mpesa.stk.confirmation", reference: "QGH1X8K2LM", amount: 200, signatureValid: true, processed: false, createdAt: daysAgo(0, 7) },
  { id: "c2", gateway: "USDT", eventType: "tron.transfer", reference: "0x9a2f…c17b", amount: 1000, signatureValid: true, processed: false, createdAt: daysAgo(0, 6) },
  { id: "c3", gateway: "M-Pesa", eventType: "mpesa.stk.confirmation", reference: "BAD1SIGN", amount: 50, signatureValid: false, processed: false, createdAt: daysAgo(1, 3) },
];

const ledger: LedgerEntry[] = [
  { id: "l1", userId: "u1", user: "Grace Wanjiru", type: "DEPOSIT", amount: 300, balanceAfter: 12450.8, note: "M-Pesa RT4M2NQXK0", createdAt: daysAgo(2, 11) },
  { id: "l2", userId: "u1", user: "Grace Wanjiru", type: "BONUS", amount: 300, balanceAfter: 12450.8, note: "100% deposit bonus", createdAt: daysAgo(2, 11) },
  { id: "l3", userId: "u4", user: "Kevin Mwangi", type: "TRADE_CREDIT", amount: 205, balanceAfter: 15600, note: "Won BTC/USD SELL", createdAt: daysAgo(0, 7) },
  { id: "l4", userId: "u7", user: "Fatuma Ali", type: "TRADE_DEBIT", amount: -50, balanceAfter: 5400, note: "Lost GBP/JPY BUY", createdAt: daysAgo(0, 6) },
];

const kyc: KycApplication[] = [
  { id: "k1", userId: "u2", user: "Brian Otieno", docType: "National ID", status: "UNDER_REVIEW", country: "🇰🇪 KE", submittedAt: daysAgo(1, 9) },
  { id: "k2", userId: "u8", user: "Peter Nkosi", docType: "Passport", status: "UNDER_REVIEW", country: "🇿🇦 ZA", submittedAt: daysAgo(0, 10) },
  { id: "k3", userId: "u3", user: "Amina Hassan", docType: "National ID", status: "PENDING", country: "🇰🇪 KE", submittedAt: daysAgo(0, 11) },
  { id: "k4", userId: "u6", user: "David Kim", docType: "Driver Licence", status: "PENDING", country: "🇺🇸 US", submittedAt: daysAgo(0, 12) },
];

const tickets: Ticket[] = [
  { id: "t1", userId: "u3", user: "Amina Hassan", subject: "Withdrawal stuck for 2 days", body: "My M-Pesa withdrawal hasn't arrived.", category: "Withdrawal", status: "OPEN", priority: "HIGH", createdAt: daysAgo(0, 8), messages: [{ fromAdmin: false, body: "Any update?", at: daysAgo(0, 8) }] },
  { id: "t2", userId: "u2", user: "Brian Otieno", subject: "KYC rejected wrongly", body: "My ID was clear, please recheck.", category: "KYC", status: "PENDING", priority: "MEDIUM", createdAt: daysAgo(1, 14), messages: [{ fromAdmin: true, body: "Re-reviewing now.", at: daysAgo(1, 15) }] },
  { id: "t3", userId: "u4", user: "Kevin Mwangi", subject: "Bonus not credited", body: "Deposited 1000, bonus missing.", category: "Bonus", status: "OPEN", priority: "URGENT", createdAt: daysAgo(0, 9), messages: [] },
];

const adminUsers: AdminUser[] = [
  { id: "a1", email: "admin@luxytrades.io", name: "Jay Admin", role: "SUPER_ADMIN", active: true, lastSeenAt: daysAgo(0, 8) },
  { id: "a2", email: "finance@luxytrades.io", name: "Mary Ochieng", role: "FINANCE", active: true, lastSeenAt: daysAgo(0, 7) },
  { id: "a3", email: "ops@luxytrades.io", name: "Sam Kiptoo", role: "OPS", active: true, lastSeenAt: daysAgo(1, 16) },
  { id: "a4", email: "support@luxytrades.io", name: "Leah Achieng", role: "SUPPORT", active: true },
  { id: "a5", email: "auditor@luxytrades.io", name: "Tom Baker", role: "READONLY", active: false },
];

const audit: AuditLog[] = [
  { id: "x1", admin: "Mary Ochieng", action: "approve_deposit", entity: "Deposit", entityId: "d4", ip: "41.90.0.1", createdAt: daysAgo(2, 11) },
  { id: "x2", admin: "Sam Kiptoo", action: "kyc_approve", entity: "User", entityId: "u1", ip: "41.90.0.2", createdAt: daysAgo(3, 10) },
  { id: "x3", admin: "Jay Admin", action: "settle_position", entity: "Position", entityId: "p2", ip: "41.90.0.1", createdAt: daysAgo(0, 7) },
];

const settings: PlatformSettings = {
  minDeposit: 5,
  maxDeposit: 10000,
  minWithdrawal: 10,
  maxWithdrawal: 10000,
  dailyWithdrawalCap: 25000,
  defaultDepositBonus: 100,
  maxBonus: 5000,
  kycRequiredToWithdraw: true,
  maxOpenPositionsPerUser: 20,
  defaultPayoutPct: 85,
};

/* ------------------------------- email seed ------------------------------- */

/** Default SMTP transport (singleton). Password is never seeded in plaintext. */
const emailSettings: EmailSettings = {
  enabled: true,
  host: "smtp.luxytrades.io",
  port: 587,
  secure: false,
  username: "no-reply@luxytrades.io",
  fromName: "Luxytrades",
  fromEmail: "no-reply@luxytrades.io",
  replyTo: "support@luxytrades.io",
  passwordSet: false,
};

/** One template per automatic email. `{{var}}` placeholders are filled from the
 *  event payload (see server/lib/mailer.ts). */
const emailTemplates: EmailTemplate[] = [
  {
    key: "WELCOME",
    name: "Welcome email",
    description: "Sent immediately after a new trader verifies their account.",
    category: "Account",
    subject: "Welcome to Luxytrades, {{name}}!",
    body: "Hi {{name}},\n\nYour Luxytrades account is ready. Fund your wallet to start trading and claim your welcome bonus.\n\nTrade smart,\nThe Luxytrades Team",
    variables: ["name", "email"],
    enabled: true,
    updatedAt: daysAgo(30, 9),
  },
  {
    key: "DEPOSIT_CONFIRMED",
    name: "Deposit confirmed",
    description: "Sent automatically when a deposit is approved and credited.",
    category: "Money",
    subject: "Deposit confirmed — ${{amount}}",
    body: "Hi {{name}},\n\nWe've credited ${{amount}} to your wallet ({{method}} ref {{reference}}).\n\nNew balance: ${{balance}}",
    variables: ["name", "amount", "method", "reference", "balance"],
    enabled: true,
    updatedAt: daysAgo(22, 9),
  },
  {
    key: "DEPOSIT_REJECTED",
    name: "Deposit rejected",
    description: "Sent automatically when a deposit fails review or verification.",
    category: "Money",
    subject: "We couldn't process your deposit",
    body: "Hi {{name}},\n\nYour deposit of ${{amount}} could not be completed. Reason: {{reason}}.\n\nPlease contact support if you believe this is a mistake.",
    variables: ["name", "amount", "reason"],
    enabled: true,
    updatedAt: daysAgo(22, 9),
  },
  {
    key: "WITHDRAWAL_APPROVED",
    name: "Withdrawal approved",
    description: "Sent when Operations approve a withdrawal for payout.",
    category: "Money",
    subject: "Withdrawal approved — ${{amount}}",
    body: "Hi {{name}},\n\nYour withdrawal of ${{amount}} has been approved and is queued for payout to {{destination}}.",
    variables: ["name", "amount", "destination"],
    enabled: true,
    updatedAt: daysAgo(18, 9),
  },
  {
    key: "WITHDRAWAL_PAID",
    name: "Withdrawal paid",
    description: "Sent when Finance release the payout to the trader.",
    category: "Money",
    subject: "You've been paid ${{amount}}",
    body: "Hi {{name}},\n\n${{amount}} has been sent to {{destination}}. Funds normally arrive within a few minutes.\n\nNew balance: ${{balance}}",
    variables: ["name", "amount", "destination", "balance"],
    enabled: true,
    updatedAt: daysAgo(18, 9),
  },
  {
    key: "WITHDRAWAL_REJECTED",
    name: "Withdrawal rejected",
    description: "Sent automatically when a withdrawal is declined.",
    category: "Money",
    subject: "Your withdrawal was declined",
    body: "Hi {{name}},\n\nYour withdrawal of ${{amount}} was declined. Reason: {{reason}}.\n\nYour balance has not been affected.",
    variables: ["name", "amount", "reason"],
    enabled: true,
    updatedAt: daysAgo(15, 9),
  },
  {
    key: "KYC_APPROVED",
    name: "KYC approved",
    description: "Sent when a trader's identity verification is approved.",
    category: "Compliance",
    subject: "Identity verified ✅",
    body: "Hi {{name}},\n\nYour identity has been verified. Withdrawals are now fully enabled on your account.",
    variables: ["name"],
    enabled: true,
    updatedAt: daysAgo(12, 9),
  },
  {
    key: "KYC_REJECTED",
    name: "KYC rejected",
    description: "Sent when identity verification fails, with the reason.",
    category: "Compliance",
    subject: "Action needed: identity verification",
    body: "Hi {{name}},\n\nWe couldn't verify your documents. Reason: {{reason}}.\n\nPlease re-submit clear photos of a valid ID.",
    variables: ["name", "reason"],
    enabled: true,
    updatedAt: daysAgo(12, 9),
  },
  {
    key: "PASSWORD_RESET",
    name: "Password reset",
    description: "Sent when a trader requests a password reset link.",
    category: "Security",
    subject: "Reset your Luxytrades password",
    body: "Hi {{name}},\n\nUse this link to reset your password: {{link}}\n\nIf you didn't request this, you can ignore this email.",
    variables: ["name", "link"],
    enabled: false,
    updatedAt: daysAgo(9, 9),
  },
];

const emailLog: EmailLogEntry[] = [
  { id: "em1", to: "grace@example.com", template: "DEPOSIT_CONFIRMED", subject: "Deposit confirmed — $300", status: "SENT", createdAt: daysAgo(2, 11) },
  { id: "em2", to: "brian@example.com", template: "WELCOME", subject: "Welcome to Luxytrades, Brian!", status: "SENT", createdAt: daysAgo(3, 9) },
  { id: "em3", to: "amina@example.com", template: "KYC_REJECTED", subject: "Action needed: identity verification", status: "FAILED", error: "SMTP 550 mailbox unavailable", createdAt: daysAgo(1, 14) },
  { id: "em4", to: "peter@za.example", template: "WITHDRAWAL_PAID", subject: "You've been paid $900", status: "SENT", createdAt: daysAgo(3, 12) },
];

/* ------------------------------- mutable store ------------------------------ */
/* A tiny in-memory mutable copy so admin actions visibly mutate the UI while the
   real Neon/Prisma API is being wired up. Each collection is re-seeded on reload. */

export const db = {
  users,
  deposits,
  withdrawals,
  positions,
  runs,
  bots,
  markets,
  gateways,
  callbacks,
  ledger,
  kyc,
  tickets,
  adminUsers,
  audit,
  settings,
  emailSettings,
  emailTemplates,
  emailLog,
};

let seq = 1000;
const nid = (p: string) => `${p}${++seq}`;

function pushAudit(action: string, entity: string, entityId: string, admin = "Jay Admin") {
  db.audit = [{ id: nid("x"), admin, action, entity, entityId, ip: "127.0.0.1", createdAt: new Date().toISOString() }, ...db.audit];
}

/* -------------------------------- mutators -------------------------------- */

export const mutators = {
  approveDeposit(id: string) {
    const d = db.deposits.find((x) => x.id === id);
    if (!d) return;
    d.status = "COMPLETED";
    const u = db.users.find((x) => x.id === d.userId);
    if (u) u.realBalance += d.credited;
    db.ledger = [{ id: nid("l"), userId: d.userId, user: d.user, type: "DEPOSIT", amount: d.credited, balanceAfter: u?.realBalance ?? 0, note: `${d.channel} deposit approved`, createdAt: new Date().toISOString() }, ...db.ledger];
    pushAudit("approve_deposit", "Deposit", id);
  },
  rejectDeposit(id: string, reason: string) {
    const d = db.deposits.find((x) => x.id === id);
    if (!d) return;
    d.status = "REJECTED";
    pushAudit(`reject_deposit (${reason})`, "Deposit", id);
  },
  opsApproveWithdrawal(id: string) {
    const w = db.withdrawals.find((x) => x.id === id);
    if (!w) return;
    w.opsApproved = true;
    w.status = "UNDER_REVIEW";
    pushAudit("ops_approve_withdrawal", "Withdrawal", id);
  },
  payWithdrawal(id: string) {
    const w = db.withdrawals.find((x) => x.id === id);
    if (!w) return;
    w.status = "COMPLETED";
    const u = db.users.find((x) => x.id === w.userId);
    if (u) u.realBalance = Math.max(0, u.realBalance - w.amount);
    db.ledger = [{ id: nid("l"), userId: w.userId, user: w.user, type: "WITHDRAWAL", amount: -w.amount, balanceAfter: u?.realBalance ?? 0, note: `${w.channel} payout paid`, createdAt: new Date().toISOString() }, ...db.ledger];
    pushAudit("pay_withdrawal", "Withdrawal", id);
  },
  rejectWithdrawal(id: string, reason: string) {
    const w = db.withdrawals.find((x) => x.id === id);
    if (!w) return;
    w.status = "REJECTED";
    pushAudit(`reject_withdrawal (${reason})`, "Withdrawal", id);
  },
  settlePosition(id: string, won: boolean, admin = "Jay Admin") {
    const p = db.positions.find((x) => x.id === id);
    if (!p) return;
    p.status = won ? "WON" : "LOST";
    p.payout = won ? Math.round(p.amount * 0.87) : 0;
    const u = db.users.find((x) => x.id === p.userId);
    if (u && won) u.realBalance += p.payout;
    pushAudit("settle_position", "Position", id, admin);
  },
  adjustBalance(userId: string, delta: number, note: string) {
    const u = db.users.find((x) => x.id === userId);
    if (!u) return;
    u.realBalance = Math.max(0, u.realBalance + delta);
    db.ledger = [{ id: nid("l"), userId, user: u.fullName, type: "ADJUSTMENT", amount: delta, balanceAfter: u.realBalance, note, createdAt: new Date().toISOString() }, ...db.ledger];
    pushAudit(`balance_adjust (${delta})`, "User", userId);
  },
  setUserStatus(userId: string, status: User["status"]) {
    const u = db.users.find((x) => x.id === userId);
    if (!u) return;
    u.status = status;
    pushAudit(`set_user_${status.toLowerCase()}`, "User", userId);
  },
  approveKyc(id: string) {
    const k = db.kyc.find((x) => x.id === id);
    if (!k) return;
    k.status = "APPROVED";
    const u = db.users.find((x) => x.id === k.userId);
    if (u) u.kyc = "APPROVED";
    pushAudit("kyc_approve", "User", k.userId);
  },
  rejectKyc(id: string, reason: string) {
    const k = db.kyc.find((x) => x.id === id);
    if (!k) return;
    k.status = "REJECTED";
    const u = db.users.find((x) => x.id === k.userId);
    if (u) u.kyc = "REJECTED";
    pushAudit(`kyc_reject (${reason})`, "User", k?.userId ?? id);
  },
  toggleGateway(key: string) {
    const g = db.gateways.find((x) => x.key === key);
    if (!g) return;
    g.enabled = !g.enabled;
    pushAudit(g.enabled ? "gateway_enable" : "gateway_disable", "Gateway", key);
  },
  saveMpesaSettings(key: string, settings: MpesaSettings) {
    const g = db.gateways.find((x) => x.key === key);
    if (!g) return;
    g.mpesa = { ...g.mpesa, ...settings };
    // reflect the "configured" state in the masked preview too
    g.masked = settings.consumerKeySet ? "key ••••live" : "key not set";
    pushAudit("mpesa_gateway_config", "Gateway", key);
  },
  saveCryptoSettings(key: string, config: CryptoConfig, secrets?: { apiKey?: string }) {
    const g = db.gateways.find((x) => x.key === key);
    if (!g) return;
    const { minAmount, maxAmount, feePct, feeFixed, ...crypto } = config;
    g.minAmount = minAmount;
    g.maxAmount = maxAmount;
    g.feePct = feePct;
    g.feeFixed = feeFixed;
    g.crypto = { ...g.crypto, ...crypto, apiKeySet: crypto.apiKeySet || Boolean(secrets?.apiKey?.trim()) };
    g.masked = crypto.address ? `addr ${crypto.address.slice(0, 3)}…${crypto.address.slice(-3)}` : "addr not set";
    pushAudit("crypto_gateway_config", "Gateway", key);
  },
  processCallback(id: string) {
    const c = db.callbacks.find((x) => x.id === id);
    if (!c) return;
    c.processed = true;
    pushAudit("callback_match", "Callback", id);
  },
  replyTicket(id: string, body: string) {
    const t = db.tickets.find((x) => x.id === id);
    if (!t) return;
    t.messages = [...t.messages, { fromAdmin: true, body, at: new Date().toISOString() }];
    if (t.status === "OPEN") t.status = "PENDING";
    pushAudit("ticket_reply", "Ticket", id);
  },
  setTicketStatus(id: string, status: Ticket["status"]) {
    const t = db.tickets.find((x) => x.id === id);
    if (t) t.status = status;
    pushAudit(`ticket_${status.toLowerCase()}`, "Ticket", id);
  },
  setMarketPayout(code: string, payoutPct: number) {
    const m = db.markets.find((x) => x.code === code);
    if (m) m.payoutPct = payoutPct;
    pushAudit("market_payout_update", "Market", code);
  },
  toggleMarket(code: string) {
    const m = db.markets.find((x) => x.code === code);
    if (m) m.active = !m.active;
    pushAudit("market_toggle", "Market", code);
  },
  killBot(id: string) {
    const b = db.bots.find((x) => x.id === id);
    if (!b) return;
    b.status = "STOPPED";
    b.stoppedAt = new Date().toISOString();
    pushAudit("bot_kill", "Bot", id);
  },
  saveSettings(next: PlatformSettings) {
    db.settings = { ...db.settings, ...next };
    pushAudit("platform_settings_update", "Settings", "platform");
  },
  saveEmailSettings(next: EmailSettings) {
    db.emailSettings = { ...db.emailSettings, ...next };
    pushAudit("email_settings_update", "EmailSettings", "email");
  },
  saveEmailTemplate(tpl: EmailTemplate) {
    const next = { ...tpl, updatedAt: new Date().toISOString() };
    const i = db.emailTemplates.findIndex((t) => t.key === tpl.key);
    if (i >= 0) db.emailTemplates[i] = next;
    else db.emailTemplates.push(next);
    pushAudit("email_template_update", "EmailTemplate", tpl.key);
  },
  toggleEmailTemplate(key: string) {
    const t = db.emailTemplates.find((x) => x.key === key);
    if (!t) return;
    t.enabled = !t.enabled;
    pushAudit(t.enabled ? "email_template_enable" : "email_template_disable", "EmailTemplate", key);
  },
  /** Records a one-off send in the log (the mock has no real SMTP transport). */
  sendTestEmail(to: string, templateKey: string) {
    const t = db.emailTemplates.find((x) => x.key === templateKey);
    db.emailLog = [
      { id: nid("em"), to, template: templateKey, subject: t?.subject ?? "Test email", status: "SENT", createdAt: new Date().toISOString() },
      ...db.emailLog,
    ];
    pushAudit("email_test_send", "EmailLog", templateKey);
  },
  /** Pin (or clear, with null) a user's forced trade win rate (0-100). */
  setUserWinRate(userId: string, winRate: number | null) {
    const u = db.users.find((x) => x.id === userId);
    if (!u) return;
    if (winRate === null) delete u.winRate;
    else u.winRate = winRate;
    pushAudit(winRate === null ? "user_winrate_clear" : `user_winrate_set (${winRate}%)`, "User", userId);
  },
  /** Toggle instant-settle withdrawals for a user (skips ops approve + pay). */
  setUserAutoPayout(userId: string, enabled: boolean) {
    const u = db.users.find((x) => x.id === userId);
    if (!u) return;
    u.autoPayout = enabled;
    pushAudit(enabled ? "enable_auto_payout" : "disable_auto_payout", "User", userId);
  },
  /** Send a template OR a one-off custom message to a specific user (mock: logged only). */
  sendUserEmail(userId: string, payload: { template?: string; subject?: string; body?: string }) {
    const u = db.users.find((x) => x.id === userId);
    if (!u?.email) return;
    const tpl = payload.template ? db.emailTemplates.find((t) => t.key === payload.template) : undefined;
    const subject = tpl?.subject ?? payload.subject ?? "(no subject)";
    db.emailLog = [
      { id: nid("em"), to: u.email, template: payload.template ?? "CUSTOM", subject, status: "SENT", createdAt: new Date().toISOString() },
      ...db.emailLog,
    ];
    pushAudit("user_email_send", "User", userId);
  },
};

/* -------------------------------- aggregates -------------------------------- */

export function computeKpis(): Kpis {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const volumeSeries = labels.map((label, i) => ({
    label,
    deposits: 2200 + Math.round(Math.sin(i) * 900) + i * 180,
    withdrawals: 1100 + Math.round(Math.cos(i) * 500) + i * 90,
  }));
  const pendingDeposits = db.deposits.filter((d) => ["PENDING", "ACTION_REQUIRED", "UNDER_REVIEW"].includes(d.status));
  const pendingWithdrawals = db.withdrawals.filter((w) => ["PENDING", "UNDER_REVIEW", "APPROVED"].includes(w.status));
  const netPnlToday = db.positions.filter((p) => p.status !== "OPEN").reduce((s, p) => s + (p.status === "WON" ? -(p.payout ?? 0) : p.amount), 0);
  const botVolume = db.positions.filter((p) => p.bot).reduce((s, p) => s + p.amount, 0);
  return {
    activeUsers: db.users.filter((u) => u.status === "ACTIVE").length,
    pendingDepositCount: pendingDeposits.length,
    pendingDepositValue: pendingDeposits.reduce((s, d) => s + d.amount, 0),
    pendingWithdrawalCount: pendingWithdrawals.length,
    pendingWithdrawalValue: pendingWithdrawals.reduce((s, w) => s + w.amount, 0),
    openPositions: db.positions.filter((p) => p.status === "OPEN").length,
    netPnlToday,
    openTickets: db.tickets.filter((t) => ["OPEN", "PENDING"].includes(t.status)).length,
    verifiedPct: Math.round((db.users.filter((u) => u.kyc === "APPROVED").length / db.users.length) * 100),
    botVolume,
    volumeSeries,
  };
}
