import { computeKpis, db, mutators } from "./data";
import type {
  AdminRole,
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
  Kpis,
  KycApplication,
  LedgerEntry,
  Market,
  MpesaSettings,
  PlatformSettings,
  Position,
  Run,
  Session,
  Ticket,
  User,
  Withdrawal,
} from "./types";

/** When true the console talks to the live Express+Prisma API. A production build
 *  is ALWAYS live — the in-memory mock can never ship. In development the mock runs
 *  by default (so the UI is viewable with no server/Neon DB yet); set VITE_ADMIN_LIVE=1
 *  to exercise the real API locally once `npm run api:dev` + Neon are up. */
export const LIVE = import.meta.env.PROD || import.meta.env.VITE_ADMIN_LIVE === "1";
const BASE = "/admin/api";

async function live<T>(path: string, init?: RequestInit): Promise<T> {
  const token = sessionStorage.getItem("lx_admin_token") ?? "";
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

const wait = (ms = 260) => new Promise((r) => setTimeout(r, ms));

/** role → which nav sections a user may mutate (mirrors the API's RBAC). */
export function can(role: AdminRole, action: "mutate" | "read"): boolean {
  if (action === "read") return true;
  return role !== "READONLY";
}

/** The whole admin's single data facade. Read returns shallow copies. */
export const api = {
  async login(email: string, password: string): Promise<Session> {
    if (LIVE) {
      const res = await fetch(`${BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      const data = (await res.json()) as Session & { token: string };
      sessionStorage.setItem("lx_admin_token", data.token);
      return { email: data.email, name: data.name, role: data.role };
    }
    await wait();
    if (!email || password.length < 4) throw new Error("Invalid credentials");
    const match = db.adminUsers.find((a) => a.email.toLowerCase() === email.toLowerCase());
    const role: AdminRole = match?.role ?? (email.startsWith("finance") ? "FINANCE" : email.startsWith("ops") ? "OPS" : email.startsWith("support") ? "SUPPORT" : email.startsWith("audit") ? "READONLY" : "SUPER_ADMIN");
    return { email, name: match?.name ?? "Admin", role };
  },

  kpis: (): Promise<Kpis> => (LIVE ? live<Kpis>("/reports/overview") : wait().then(computeKpis)),
  users: (): Promise<User[]> => (LIVE ? live<User[]>("/users") : wait().then(() => [...db.users])),
  deposits: (): Promise<Deposit[]> => (LIVE ? live<Deposit[]>("/deposits") : wait().then(() => [...db.deposits])),
  withdrawals: (): Promise<Withdrawal[]> => (LIVE ? live<Withdrawal[]>("/withdrawals") : wait().then(() => [...db.withdrawals])),
  positions: (): Promise<Position[]> => (LIVE ? live<Position[]>("/positions") : wait().then(() => [...db.positions])),
  runs: (): Promise<Run[]> => (LIVE ? live<Run[]>("/runs") : wait().then(() => [...db.runs])),
  markets: (): Promise<Market[]> => (LIVE ? live<Market[]>("/markets") : wait().then(() => [...db.markets])),
  gateways: (): Promise<Gateway[]> => (LIVE ? live<Gateway[]>("/gateways") : wait().then(() => [...db.gateways])),
  callbacks: (): Promise<GatewayCallback[]> => (LIVE ? live<GatewayCallback[]>("/gateways/callbacks") : wait().then(() => [...db.callbacks])),
  ledger: (): Promise<LedgerEntry[]> => (LIVE ? live<LedgerEntry[]>("/ledger") : wait().then(() => [...db.ledger])),
  kyc: (): Promise<KycApplication[]> => (LIVE ? live<KycApplication[]>("/kyc") : wait().then(() => [...db.kyc])),
  tickets: (): Promise<Ticket[]> => (LIVE ? live<Ticket[]>("/tickets") : wait().then(() => [...db.tickets])),
  adminUsers: (): Promise<AdminUser[]> => (LIVE ? live<AdminUser[]>("/admin-users") : wait().then(() => [...db.adminUsers])),
  audit: (): Promise<AuditLog[]> => (LIVE ? live<AuditLog[]>("/audit") : wait().then(() => [...db.audit])),
  bots: (): Promise<BotConfig[]> => (LIVE ? live<BotConfig[]>("/bots") : wait().then(() => [...db.bots])),
  settings: (): Promise<PlatformSettings> => (LIVE ? live<PlatformSettings>("/settings") : wait().then(() => ({ ...db.settings }))),

  /* --------------------------- M-Pesa gateway config --------------------------- */

  async mpesaSettings(): Promise<MpesaSettings | null> {
    if (LIVE) {
      try {
        const s = await live<any>("/gateways/mpesa/settings");
        return {
          env: s.env,
          transactionType: s.transactionType,
          shortcode: s.shortcode ?? "",
          tillNumber: s.tillNumber ?? "",
          callbackUrl: s.callbackUrl ?? "",
          accountRef: s.accountRef ?? "",
          transactionDesc: s.transactionDesc ?? "",
          kesRate: s.kesRate ?? 129.4,
          consumerKeySet: Boolean(s.consumerKey?.set),
          consumerSecretSet: Boolean(s.consumerSecret?.set),
          passkeySet: Boolean(s.passkey?.set),
        };
      } catch {
        return null;
      }
    }
    await wait();
    return db.gateways.find((g) => g.key === "mpesa")?.mpesa ?? null;
  },

  async saveMpesaSettings(
    key: string,
    settings: MpesaSettings,
    secrets?: { consumerKey?: string; consumerSecret?: string; passkey?: string },
  ): Promise<void> {
    if (LIVE) {
      await live("/gateways/mpesa/settings", {
        method: "POST",
        body: JSON.stringify({
          env: settings.env,
          transactionType: settings.transactionType,
          shortcode: settings.shortcode,
          tillNumber: settings.tillNumber,
          callbackUrl: settings.callbackUrl,
          accountRef: settings.accountRef,
          transactionDesc: settings.transactionDesc,
          kesRate: settings.kesRate,
          ...(secrets?.consumerKey ? { consumerKey: secrets.consumerKey } : {}),
          ...(secrets?.consumerSecret ? { consumerSecret: secrets.consumerSecret } : {}),
          ...(secrets?.passkey ? { passkey: secrets.passkey } : {}),
        }),
      });
      return;
    }
    await wait(180);
    mutators.saveMpesaSettings(key, settings);
  },

  async testMpesaGateway(): Promise<{ ok: boolean; message: string }> {
    if (LIVE) {
      try {
        const r = await live<{ ok: boolean; message?: string; error?: string }>("/gateways/mpesa/test", { method: "POST" });
        return { ok: r.ok, message: r.ok ? r.message ?? "Daraja reachable" : r.error ?? "Connection failed" };
      } catch (e) {
        return { ok: false, message: (e as Error).message };
      }
    }
    await wait(900);
    const g = db.gateways.find((x) => x.key === "mpesa");
    const set = g?.mpesa;
    if (!set?.shortcode) return { ok: false, message: "Head-office paybill shortcode is required" };
    if (!set?.consumerKeySet || !set?.consumerSecretSet || !set?.passkeySet) {
      return { ok: false, message: "M-Pesa not fully configured — add Consumer Key, Secret & Passkey" };
    }
    return { ok: true, message: `Daraja ${set.env} reachable — head office ${set.shortcode} (CustomerPayBillOnline)${set.tillNumber ? ` · till ${set.tillNumber} as account reference` : ""}` };
  },

  /* ---------------------------- crypto gateway config --------------------------- */

  async cryptoSettings(key: string): Promise<CryptoConfig | null> {
    if (LIVE) {
      try {
        return await live<CryptoConfig>(`/gateways/${key}/settings`);
      } catch {
        return null;
      }
    }
    await wait();
    const g = db.gateways.find((x) => x.key === key);
    if (!g) return null;
    return {
      network: g.crypto?.network ?? "",
      address: g.crypto?.address ?? "",
      confirmations: g.crypto?.confirmations ?? 2,
      autoCredit: g.crypto?.autoCredit ?? false,
      callbackUrl: g.crypto?.callbackUrl ?? "",
      apiKeySet: g.crypto?.apiKeySet ?? false,
      minAmount: g.minAmount,
      maxAmount: g.maxAmount,
      feePct: g.feePct,
      feeFixed: g.feeFixed,
    };
  },

  async saveCryptoSettings(key: string, config: CryptoConfig, secrets?: { apiKey?: string }): Promise<void> {
    if (LIVE) {
      await live(`/gateways/${key}/settings`, {
        method: "POST",
        body: JSON.stringify({ ...config, ...(secrets?.apiKey?.trim() ? { apiKey: secrets.apiKey.trim() } : {}) }),
      });
      return;
    }
    await wait(180);
    mutators.saveCryptoSettings(key, config, secrets);
  },

  /** Validate a crypto gateway's config. There is no chain adapter in this build,
   *  so the check is a format/completeness probe rather than a live RPC call. */
  async testCryptoGateway(key: string): Promise<{ ok: boolean; message: string }> {
    if (LIVE) {
      try {
        const r = await live<{ ok: boolean; message?: string; error?: string }>(`/gateways/${key}/test`, { method: "POST" });
        return { ok: r.ok, message: r.ok ? r.message ?? "Gateway config valid" : r.error ?? "Gateway config invalid" };
      } catch (e) {
        return { ok: false, message: (e as Error).message };
      }
    }
    await wait(700);
    const g = db.gateways.find((x) => x.key === key);
    const c = g?.crypto;
    if (!c?.address) return { ok: false, message: "Receiving wallet address is required" };
    if (!/^(T[1-9A-HJ-NP-Za-km-z]{33}|(bc1|tb1)[0-9a-z]{11,71}|0x[0-9a-fA-F]{40})$/.test(c.address)) {
      return { ok: false, message: `"${c.address}" is not a valid ${c.network || "crypto"} address` };
    }
    return { ok: true, message: `${g?.label} — ${c.network} address accepted · ${c.confirmations} confirmation${c.confirmations === 1 ? "" : "s"} required` };
  },

  /* ------------------------------ platform settings ---------------------------- */

  async saveSettings(next: PlatformSettings): Promise<void> {
    if (LIVE) {
      await live("/settings", { method: "POST", body: JSON.stringify(next) });
      return;
    }
    await wait(180);
    mutators.saveSettings(next);
  },

  /* ---------------------------------- email ---------------------------------- */

  async emailSettings(): Promise<EmailSettings> {
    if (LIVE) {
      const s = await live<any>("/email/settings");
      return {
        enabled: Boolean(s.enabled),
        host: s.host ?? "",
        port: s.port ?? 587,
        secure: Boolean(s.secure),
        username: s.username ?? "",
        fromName: s.fromName ?? "",
        fromEmail: s.fromEmail ?? "",
        replyTo: s.replyTo ?? "",
        passwordSet: Boolean(s.passwordSet),
      };
    }
    await wait();
    return { ...db.emailSettings };
  },

  async saveEmailSettings(next: EmailSettings, password?: string): Promise<void> {
    if (LIVE) {
      await live("/email/settings", {
        method: "POST",
        body: JSON.stringify({ ...next, ...(password?.trim() ? { password: password.trim() } : {}) }),
      });
      return;
    }
    await wait(180);
    mutators.saveEmailSettings({ ...next, passwordSet: next.passwordSet || Boolean(password?.trim()) });
  },

  /** Probe the SMTP transport (verify connection / auth) without sending mail. */
  async testEmailConnection(): Promise<{ ok: boolean; message: string }> {
    if (LIVE) {
      try {
        const r = await live<{ ok: boolean; message?: string; error?: string }>("/email/test-connection", { method: "POST" });
        return { ok: r.ok, message: r.ok ? r.message ?? "SMTP reachable" : r.error ?? "Connection failed" };
      } catch (e) {
        return { ok: false, message: (e as Error).message };
      }
    }
    await wait(700);
    const s = db.emailSettings;
    if (!s.host) return { ok: false, message: "SMTP host is required" };
    if (!s.fromEmail) return { ok: false, message: "A from-address is required" };
    if (!s.passwordSet) return { ok: false, message: "SMTP password not set — add credentials to enable sending" };
    return { ok: true, message: `${s.host}:${s.port} reachable (${s.secure ? "implicit TLS" : "STARTTLS"})` };
  },

  emailTemplates: (): Promise<EmailTemplate[]> =>
    LIVE ? live<EmailTemplate[]>("/email/templates") : wait().then(() => db.emailTemplates.map((t) => ({ ...t }))),
  emailLog: (): Promise<EmailLogEntry[]> =>
    LIVE ? live<EmailLogEntry[]>("/email/log") : wait().then(() => [...db.emailLog]),

  async saveEmailTemplate(tpl: EmailTemplate): Promise<void> {
    if (LIVE) {
      await live(`/email/templates/${tpl.key}`, { method: "POST", body: JSON.stringify(tpl) });
      return;
    }
    await wait(180);
    mutators.saveEmailTemplate(tpl);
  },

  async toggleEmailTemplate(key: string): Promise<void> {
    if (LIVE) {
      await live(`/email/templates/${key}/toggle`, { method: "POST" });
      return;
    }
    await wait(180);
    mutators.toggleEmailTemplate(key);
  },

  /** Send a template to a given address (a live test of the whole pipeline). */
  async sendTestEmail(to: string, templateKey: string): Promise<void> {
    if (LIVE) {
      await live("/email/test-send", { method: "POST", body: JSON.stringify({ to, template: templateKey }) });
      return;
    }
    await wait(700);
    mutators.sendTestEmail(to, templateKey);
  },

  /** Send a stored template OR a one-off custom message to a specific user. */
  async sendUserEmail(userId: string, payload: { template?: string; subject?: string; body?: string }): Promise<void> {
    if (LIVE) {
      await live(`/users/${userId}/email`, { method: "POST", body: JSON.stringify(payload) });
      return;
    }
    await wait(600);
    mutators.sendUserEmail(userId, payload);
  },

  /** run a mutating action; in mock mode it edits the in-memory store, in live
   *  mode it POSTs to the matching REST endpoint (see server/routes/mutations.ts). */
  async act(name: keyof typeof mutators, ...args: unknown[]): Promise<void> {
    if (LIVE) {
      const [id, b, c] = args as [string, unknown, unknown];
      // name → [path, body]
      const map: Record<string, [string, Record<string, unknown> | undefined]> = {
        approveDeposit: [`/deposits/${id}/approve`, undefined],
        rejectDeposit: [`/deposits/${id}/reject`, { reason: b }],
        opsApproveWithdrawal: [`/withdrawals/${id}/ops-approve`, undefined],
        payWithdrawal: [`/withdrawals/${id}/pay`, undefined],
        rejectWithdrawal: [`/withdrawals/${id}/reject`, { reason: b }],
        settlePosition: [`/positions/${id}/settle`, { won: b }],
        adjustBalance: [`/users/${id}/adjust-balance`, { delta: b, note: c }],
        setUserStatus: [`/users/${id}/status`, { status: b }],
        setUserWinRate: [`/users/${id}/win-rate`, { winRate: b ?? null }],
        approveKyc: [`/kyc/${id}/approve`, undefined],
        rejectKyc: [`/kyc/${id}/reject`, { reason: b }],
        toggleGateway: [`/gateways/${id}/toggle`, undefined],
        processCallback: [`/gateways/callbacks/${id}/process`, undefined],
        replyTicket: [`/tickets/${id}/reply`, { body: b }],
        setTicketStatus: [`/tickets/${id}/status`, { status: b }],
        setMarketPayout: [`/markets/${id}/payout`, { payoutPct: b }],
        toggleMarket: [`/markets/${id}/toggle`, undefined],
        killBot: [`/bots/${id}/kill`, undefined],
      };
      const entry = map[name];
      if (!entry) throw new Error(`No live endpoint for action "${name}"`);
      const [path, body] = entry;
      await live(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
      return;
    }
    await wait(180);
    (mutators[name] as (...a: unknown[]) => void)(...args);
  },
};
