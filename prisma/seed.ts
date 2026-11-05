import { PrismaClient, type MarketCategory, type AdminRole } from "@prisma/client";
import { hashPassword } from "../server/lib/auth.js";

/**
 * Clean production bootstrap.
 *
 * This seeds ONLY platform configuration that the product needs to boot and be
 * operable — instrument catalogue, gateway stubs, staff logins, automatic-email
 * templates and the settings singletons. It deliberately seeds NO traders, NO
 * balances, NO deposits/withdrawals/positions/ledger, and NO fabricated payment
 * credentials. Every real account starts at $0 and grows only from confirmed,
 * server-side money movement (M-Pesa callback / finance approval).
 *
 * It is idempotent: config rows are upserted or created-if-missing so re-running
 * `npm run db:seed` never clobbers admin edits (a configured SMTP password, a
 * changed admin password, platform limits) or destroys live user data.
 */

const prisma = new PrismaClient();

/* ------------------------------ market universe ---------------------------- */
// Mirrors the instrument list the trader UI renders (src/data.ts) so the app shows
// the same pairs the back-office can configure payouts for. basePrice is the seed
// anchor for the server-side random-walk price feed — not fabricated account data.
const MARKETS: {
  code: string; name: string; category: MarketCategory; digits: number; basePrice: number; payoutPct: number;
}[] = [
  { code: "EURUSD", name: "EUR/USD", category: "FOREX", digits: 5, basePrice: 1.08452, payoutPct: 87 },
  { code: "GBPUSD", name: "GBP/USD", category: "FOREX", digits: 5, basePrice: 1.2712, payoutPct: 85 },
  { code: "USDJPY", name: "USD/JPY", category: "FOREX", digits: 3, basePrice: 149.52, payoutPct: 86 },
  { code: "GBPJPY", name: "GBP/JPY", category: "FOREX", digits: 3, basePrice: 190.31, payoutPct: 86 },
  { code: "USDCHF", name: "USD/CHF", category: "FOREX", digits: 5, basePrice: 0.8721, payoutPct: 85 },
  { code: "AUDUSD", name: "AUD/USD", category: "FOREX", digits: 5, basePrice: 0.6584, payoutPct: 85 },
  { code: "USDCAD", name: "USD/CAD", category: "FOREX", digits: 5, basePrice: 1.3612, payoutPct: 85 },
  { code: "XAUUSD", name: "XAU/USD", category: "COMMODITIES", digits: 2, basePrice: 2745.2, payoutPct: 80 },
  { code: "XAGUSD", name: "XAG/USD", category: "COMMODITIES", digits: 3, basePrice: 31.84, payoutPct: 80 },
  { code: "USOIL", name: "USOIL", category: "COMMODITIES", digits: 2, basePrice: 71.42, payoutPct: 82 },
  { code: "US500", name: "US500", category: "INDICES", digits: 1, basePrice: 5721.4, payoutPct: 90 },
  { code: "NAS100", name: "NAS100", category: "INDICES", digits: 1, basePrice: 20312.6, payoutPct: 90 },
  { code: "GER40", name: "GER40", category: "INDICES", digits: 1, basePrice: 19452.8, payoutPct: 88 },
  { code: "BTCUSD", name: "BTC/USD", category: "CRYPTO", digits: 1, basePrice: 71240.0, payoutPct: 82 },
  { code: "ETHUSD", name: "ETH/USD", category: "CRYPTO", digits: 2, basePrice: 3842.5, payoutPct: 82 },
  { code: "SOLUSD", name: "SOL/USD", category: "CRYPTO", digits: 2, basePrice: 172.34, payoutPct: 82 },
];

/* -------------------------------- gateways -------------------------------- */
// Stubs only: listed so the console has something to configure, but every one
// ships DISABLED and WITHOUT secrets. Funds are live only after an operator turns
// a gateway on and enters real credentials in the admin "Payment Gateways" screen.
const GATEWAYS: { key: string; kind: any; label: string; minAmount: number; maxAmount: number; feePct: number; feeFixed: number }[] = [
  { key: "mpesa", kind: "MPESA_DARAJA", label: "M-Pesa (Safaricom)", minAmount: 5, maxAmount: 5000, feePct: 0, feeFixed: 0 },
  { key: "usdt", kind: "CRYPTO_USDT_TRC20", label: "USDT · TRC20", minAmount: 20, maxAmount: 100000, feePct: 1, feeFixed: 1 },
  { key: "btc", kind: "CRYPTO_BTC", label: "Bitcoin", minAmount: 50, maxAmount: 50000, feePct: 0.5, feeFixed: 2 },
  { key: "bank", kind: "BANK", label: "Bank transfer", minAmount: 50, maxAmount: 25000, feePct: 0, feeFixed: 0 },
];

/* ------------------------------- email keys ------------------------------- */
const EMAIL_TEMPLATES = [
  {
    key: "WELCOME", name: "Welcome email", category: "Account",
    description: "Sent immediately after a new trader registers their account.",
    subject: "Welcome to Luxytrades, {{name}}!",
    body: "Hi {{name}},\n\nYour Luxytrades account is ready. Fund your wallet to start trading.\n\nTrade smart,\nThe Luxytrades Team",
    variables: ["name", "email"], enabled: true,
  },
  {
    key: "DEPOSIT_CONFIRMED", name: "Deposit confirmed", category: "Money",
    description: "Sent automatically when a deposit is approved and credited.",
    subject: "Deposit confirmed — ${{amount}}",
    body: "Hi {{name}},\n\nWe've credited ${{amount}} to your wallet ({{method}} ref {{reference}}).\n\nNew balance: ${{balance}}",
    variables: ["name", "amount", "method", "reference", "balance"], enabled: true,
  },
  {
    key: "DEPOSIT_REJECTED", name: "Deposit rejected", category: "Money",
    description: "Sent automatically when a deposit fails review or verification.",
    subject: "We couldn't process your deposit",
    body: "Hi {{name}},\n\nYour deposit of ${{amount}} could not be completed. Reason: {{reason}}.\n\nPlease contact support if you believe this is a mistake.",
    variables: ["name", "amount", "reason"], enabled: true,
  },
  {
    key: "WITHDRAWAL_APPROVED", name: "Withdrawal approved", category: "Money",
    description: "Sent when Operations approve a withdrawal for payout.",
    subject: "Withdrawal approved — ${{amount}}",
    body: "Hi {{name}},\n\nYour withdrawal of ${{amount}} has been approved and is queued for payout to {{destination}}.",
    variables: ["name", "amount", "destination"], enabled: true,
  },
  {
    key: "WITHDRAWAL_PAID", name: "Withdrawal paid", category: "Money",
    description: "Sent when Finance release the payout to the trader.",
    subject: "You've been paid ${{amount}}",
    body: "Hi {{name}},\n\n${{amount}} has been sent to {{destination}}. Funds normally arrive within a few minutes.\n\nNew balance: ${{balance}}",
    variables: ["name", "amount", "destination", "balance"], enabled: true,
  },
  {
    key: "WITHDRAWAL_REJECTED", name: "Withdrawal rejected", category: "Money",
    description: "Sent automatically when a withdrawal is declined.",
    subject: "Your withdrawal was declined",
    body: "Hi {{name}},\n\nYour withdrawal of ${{amount}} was declined. Reason: {{reason}}.\n\nYour balance has been refunded.",
    variables: ["name", "amount", "reason"], enabled: true,
  },
  {
    key: "KYC_APPROVED", name: "KYC approved", category: "Compliance",
    description: "Sent when a trader's identity verification is approved.",
    subject: "Identity verified",
    body: "Hi {{name}},\n\nYour identity has been verified. Withdrawals are now fully enabled on your account.",
    variables: ["name"], enabled: true,
  },
  {
    key: "KYC_REJECTED", name: "KYC rejected", category: "Compliance",
    description: "Sent when identity verification fails, with the reason.",
    subject: "Action needed: identity verification",
    body: "Hi {{name}},\n\nWe couldn't verify your documents. Reason: {{reason}}.\n\nPlease re-submit clear photos of a valid ID.",
    variables: ["name", "reason"], enabled: true,
  },
  {
    key: "PASSWORD_RESET", name: "Password reset", category: "Security",
    description: "Sent when a trader requests a password reset link.",
    subject: "Reset your Luxytrades password",
    body: "Hi {{name}},\n\nUse this link to reset your password: {{link}}\n\nIf you didn't request this, you can ignore this email.",
    variables: ["name", "link"], enabled: false,
  },
];

async function main() {
  console.log("Bootstrapping Luxytrades (production config, no demo data)…");

  /* ----------------------------- markets (upsert) ---------------------------- */
  for (const m of MARKETS) {
    await prisma.market.upsert({
      where: { code: m.code },
      create: { ...m, active: true },
      // Refresh the catalogue shape but never overwrite an operator's payout/active edit.
      update: { name: m.name, category: m.category, digits: m.digits },
    });
  }
  console.log(`  · ${MARKETS.length} markets`);

  /* ---------------------------- gateways (upsert) ---------------------------- */
  for (const g of GATEWAYS) {
    await prisma.gateway.upsert({
      where: { key: g.key },
      create: { ...g, enabled: false, secretEnc: null },
      // Never touch `enabled` or `secretEnc` on re-seed — only keep label/limits in sync.
      update: { label: g.label, kind: g.kind, minAmount: g.minAmount, maxAmount: g.maxAmount, feePct: g.feePct, feeFixed: g.feeFixed },
    });
  }
  console.log(`  · ${GATEWAYS.length} gateway stubs (disabled, no credentials)`);

  /* --------------------- platform settings (create-if-missing) --------------- */
  if (!(await prisma.platformSettings.findUnique({ where: { id: "platform" } }))) {
    await prisma.platformSettings.create({ data: { id: "platform" } }); // schema defaults
  }
  console.log("  · platform settings");

  /* ---------------------- email settings (create-if-missing) ---------------- */
  if (!(await prisma.emailSettings.findUnique({ where: { id: "email" } }))) {
    // Left blank/unconfigured: no fabricated SMTP host, no password.
    await prisma.emailSettings.create({
      data: { id: "email", enabled: false, host: "", username: "", fromName: "Luxytrades", fromEmail: "", replyTo: "" },
    });
  }
  console.log("  · email settings (unconfigured)");

  /* ------------------------- email templates (upsert) ----------------------- */
  for (const t of EMAIL_TEMPLATES) {
    await prisma.emailTemplate.upsert({
      where: { key: t.key },
      create: { ...t, variables: [...t.variables] },
      // Keep existing content on re-run; only ensure the row exists.
      update: {},
    });
  }
  console.log(`  · ${EMAIL_TEMPLATES.length} email templates`);

  /* ---------------------------- staff logins (create) ----------------------- */
  // Credentials come from the environment so nothing secret is committed. Fall back
  // to the well-known demo values ONLY when env is unset, and warn loudly.
  const bootstrapPassword = process.env.ADMIN_PASSWORD?.trim() || "demo1234";
  const usingDefault = !process.env.ADMIN_PASSWORD?.trim();
  const staff: { email: string; name: string; role: AdminRole }[] = [
    { email: (process.env.ADMIN_EMAIL?.trim() || "admin@luxytrades.io"), name: "Super Admin", role: "SUPER_ADMIN" },
    { email: "finance@luxytrades.io", name: "Finance", role: "FINANCE" },
    { email: "ops@luxytrades.io", name: "Operations", role: "OPS" },
    { email: "support@luxytrades.io", name: "Support", role: "SUPPORT" },
  ];
  const hash = hashPassword(bootstrapPassword);
  for (const a of staff) {
    if (await prisma.adminUser.findUnique({ where: { email: a.email } })) continue; // don't reset a changed password
    await prisma.adminUser.create({ data: { email: a.email, name: a.name, role: a.role, active: true, passwordHash: hash } });
  }
  console.log(`  · ${staff.length} staff accounts`);

  if (usingDefault) {
    console.warn("\n  ⚠ Admin password is the default 'demo1234'. Set ADMIN_PASSWORD and change it before going live.");
  }
  console.log(`\nBootstrap complete. Super admin: ${staff[0].email}`);
  console.log("No traders, balances, deposits, or payment credentials were seeded — everything real starts from zero.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
