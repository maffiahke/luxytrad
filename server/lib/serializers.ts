import type {
  AdminUser,
  AuditLog,
  BotConfig,
  Deposit,
  EmailLogEntry,
  EmailSettings,
  EmailTemplate,
  Gateway,
  GatewayCallback,
  KycApplication,
  LedgerEntry,
  Market,
  PlatformSettings,
  Position,
  Run,
  Ticket,
  User,
  Withdrawal,
} from "../../src/admin/types.js";

/**
 * These mappers turn Prisma result rows (Date fields, null columns, no denormalized
 * display names) into the EXACT JSON shapes declared in src/admin/types.ts that the
 * console already consumes from the mock adapter. Inputs are typed loosely because the
 * `include`d relation shapes vary; outputs are strongly typed to the frontend contract.
 */

const iso = (d: Date | null | undefined): string | undefined => (d ? new Date(d).toISOString() : undefined);
const str = (d: Date | null | undefined): string => (d ? new Date(d).toISOString() : new Date().toISOString());
const uname = (row: any): string => row?.user?.fullName ?? "";

export function mapUser(r: any): User {
  return {
    id: r.id,
    phone: r.phone,
    email: r.email ?? undefined,
    fullName: r.fullName,
    countryCode: r.countryCode,
    status: r.status,
    kyc: r.kyc,
    referralCode: r.referralCode,
    referredBy: r.referredBy ?? undefined,
    lastLoginAt: iso(r.lastLoginAt),
    createdAt: str(r.createdAt),
    realBalance: r.realBalance,
    demoBalance: r.demoBalance,
    winRate: r.winRate ?? undefined,
  };
}

export function mapDeposit(r: any): Deposit {
  return {
    id: r.id,
    userId: r.userId,
    user: uname(r),
    channel: r.channel,
    amount: r.amount,
    bonusPct: r.bonusPct,
    credited: r.credited,
    status: r.status,
    reference: r.reference ?? undefined,
    mpesaCode: r.mpesaCode ?? undefined,
    createdAt: str(r.createdAt),
  };
}

export function mapWithdrawal(r: any): Withdrawal {
  return {
    id: r.id,
    userId: r.userId,
    user: uname(r),
    channel: r.channel,
    amount: r.amount,
    fee: r.fee,
    destination: r.destination,
    status: r.status,
    opsApproved: r.opsApproved,
    createdAt: str(r.createdAt),
  };
}

export function mapPosition(r: any): Position {
  return {
    id: r.id,
    userId: r.userId,
    user: uname(r),
    market: r.market,
    side: r.side,
    amount: r.amount,
    entryPrice: r.entryPrice,
    closePrice: r.closePrice ?? undefined,
    duration: r.duration,
    status: r.status,
    payout: r.payout ?? undefined,
    runId: r.runId ?? undefined,
    openedAt: str(r.openedAt),
    expiresAt: str(r.expiresAt),
  };
}

export function mapRun(r: any): Run {
  return {
    id: r.id,
    userId: r.userId,
    user: uname(r),
    market: r.market,
    side: r.side,
    amount: r.amount,
    duration: r.duration,
    total: r.total,
    remaining: r.remaining,
    status: r.status,
  };
}

export function mapBot(r: any): BotConfig {
  return {
    id: r.id,
    userId: r.userId,
    market: r.market,
    stake: r.stake,
    duration: r.duration,
    total: r.total,
    repeat: r.repeat,
    direction: "MOMENTUM",
    takeProfit: r.takeProfit,
    stopLoss: r.stopLoss,
    earlyClose: r.earlyClose,
    status: r.status,
    activeRunId: r.activeId ?? undefined,
    done: r.done,
    realized: r.realized,
    createdAt: str(r.createdAt),
    startedAt: iso(r.startedAt),
    stoppedAt: iso(r.stoppedAt),
  };
}

export function mapMarket(r: Market): Market {
  return {
    code: r.code,
    name: r.name,
    category: r.category,
    digits: r.digits,
    basePrice: r.basePrice,
    payoutPct: r.payoutPct,
    active: r.active,
  };
}

export function mapGateway(g: Gateway): Gateway {
  return { ...g };
}

export function mapCallback(r: any): GatewayCallback {
  return {
    id: r.id,
    gateway: r.gateway,
    eventType: r.eventType,
    reference: r.reference ?? undefined,
    amount: r.amount ?? undefined,
    signatureValid: r.signatureValid,
    processed: r.processed,
    createdAt: str(r.createdAt),
  };
}

export function mapLedger(r: any): LedgerEntry {
  return {
    id: r.id,
    userId: r.userId,
    user: uname(r),
    type: r.type,
    amount: r.amount,
    balanceAfter: r.balanceAfter,
    note: r.note ?? undefined,
    createdAt: str(r.createdAt),
  };
}

export function mapKyc(r: any): KycApplication {
  return {
    id: r.id,
    userId: r.userId,
    user: uname(r),
    docType: r.docType,
    status: r.status,
    country: r.country,
    submittedAt: str(r.submittedAt),
  };
}

export function mapTicket(r: any): Ticket {
  return {
    id: r.id,
    userId: r.userId,
    user: uname(r),
    subject: r.subject,
    body: r.body,
    category: r.category,
    status: r.status,
    priority: r.priority,
    createdAt: str(r.createdAt),
    messages: (r.messages ?? []).map((m: any) => ({ fromAdmin: !!m.fromAdmin, body: m.body, at: str(m.at) })),
  };
}

export function mapAdmin(r: any): AdminUser {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.role,
    active: r.active,
    lastSeenAt: iso(r.lastSeenAt),
  };
}

export function mapAudit(r: any): AuditLog {
  return {
    id: r.id,
    admin: r.admin,
    action: r.action,
    entity: r.entity,
    entityId: r.entityId,
    ip: r.ip ?? undefined,
    createdAt: str(r.createdAt),
  };
}

export function mapSettings(r: any): PlatformSettings {
  return {
    minDeposit: r.minDeposit,
    maxDeposit: r.maxDeposit,
    minWithdrawal: r.minWithdrawal,
    maxWithdrawal: r.maxWithdrawal,
    dailyWithdrawalCap: r.dailyWithdrawalCap,
    defaultDepositBonus: r.defaultDepositBonus,
    maxBonus: r.maxBonus,
    kycRequiredToWithdraw: r.kycRequiredToWithdraw,
    maxOpenPositionsPerUser: r.maxOpenPositionsPerUser,
    defaultPayoutPct: r.defaultPayoutPct,
  };
}

export function mapEmailSettings(r: any): EmailSettings {
  return {
    enabled: r.enabled,
    host: r.host,
    port: r.port,
    secure: r.secure,
    username: r.username,
    fromName: r.fromName,
    fromEmail: r.fromEmail,
    replyTo: r.replyTo,
    // The password column is never emitted — only whether one is on file.
    passwordSet: Boolean(r.passwordEnc),
  };
}

export function mapEmailTemplate(r: any): EmailTemplate {
  return {
    key: r.key,
    name: r.name,
    description: r.description,
    category: r.category as EmailTemplate["category"],
    subject: r.subject,
    body: r.body,
    variables: r.variables ?? [],
    enabled: r.enabled,
    updatedAt: str(r.updatedAt),
  };
}

export function mapEmailLog(r: any): EmailLogEntry {
  return {
    id: r.id,
    to: r.to,
    template: r.template,
    subject: r.subject,
    status: r.status as EmailLogEntry["status"],
    error: r.error ?? undefined,
    createdAt: str(r.createdAt),
  };
}
