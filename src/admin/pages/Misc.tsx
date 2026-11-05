import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { api, can } from "../api";
import { useAdmin, useResource } from "../AdminStore";
import { DataTable, type Column } from "../DataTable";
import { Drawer, Field, inputCls } from "../sheets";
import { Badge, PageHeader, StatCard, StatusPills, money, shortDate, statusTone } from "../ui";
import { useToast } from "../../components/Toast";
import type { AdminUser, AuditLog, PlatformSettings, Ticket } from "../types";

/* --------------------------------- Support -------------------------------- */

export function Support() {
  const { session, refresh } = useAdmin();
  const toast = useToast();
  const { loading, data } = useResource(api.tickets, []);
  const [tab, setTab] = useState<"open" | "all">("open");
  const [sel, setSel] = useState<Ticket | null>(null);
  const [reply, setReply] = useState("");
  const mutate = session?.role !== "READONLY";

  const rows = useMemo(() => (data ?? []).filter((t) => (tab === "open" ? t.status === "OPEN" || t.status === "PENDING" : true)), [data, tab]);

  const send = async () => {
    if (!sel || reply.trim().length < 1) return;
    await api.act("replyTicket", sel.id, reply.trim());
    toast.success("Reply sent", `to ${sel.user}`);
    setReply("");
    const fresh = await api.tickets();
    const updated = (fresh as Ticket[]).find((t) => t.id === sel.id) ?? null;
    setSel(updated);
    refresh();
  };
  const setStatus = async (t: Ticket, status: Ticket["status"]) => { await api.act("setTicketStatus", t.id, status); toast.info("Ticket updated", `${t.subject} → ${status}`); refresh(); };

  const cols: Column<Ticket>[] = [
    { key: "subject", header: "Subject", cell: (t) => <div><div className="font-extrabold text-slate-900">{t.subject}</div><div className="text-[11px] font-semibold text-slate-400">{t.user}</div></div> },
    { key: "category", header: "Category", align: "center", hideOnTablet: true, cell: (t) => <Badge label={t.category} tone="violet" /> },
    { key: "priority", header: "Priority", align: "center", cell: (t) => <Badge label={t.priority} tone={t.priority === "URGENT" ? "red" : t.priority === "HIGH" ? "amber" : "slate"} /> },
    { key: "status", header: "Status", align: "center", cell: (t) => <Badge label={t.status} tone={statusTone(t.status)} /> },
    { key: "createdAt", header: "Opened", align: "right", hideOnTablet: true, cell: (t) => <span className="text-slate-400">{shortDate(t.createdAt)}</span> },
  ];

  return (
    <>
      <PageHeader title="Support" subtitle={`${rows.length} tickets`} actions={<StatusPills value={tab} onChange={setTab} options={[{ label: "Open", value: "open" }, { label: "All", value: "all" }]} />} />
      <DataTable rows={rows} columns={cols} getId={(t) => t.id} onRowClick={setSel} mobileKeys={["subject", "status", "priority"]} loading={loading} />
      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.subject ?? ""} subtitle={sel ? `${sel.user} · ${sel.category}` : ""}
        footer={sel && mutate ? (
          <div className="flex gap-2">
            {(["RESOLVED", "CLOSED"] as const).map((s) => (
              <button key={s} className="mt-0 flex-1 rounded-[12px] bg-slate-100 py-2.5 text-[12px] font-extrabold text-slate-600 active:scale-95" onClick={() => { setStatus(sel, s); }}>{s}</button>
            ))}
          </div>
        ) : undefined}>
        {sel && (
          <>
            <div className="mb-2 space-y-2">
              {sel.messages.map((m, i) => (
                <div key={i} className={`max-w-[85%] rounded-[12px] px-3 py-2 text-[12.5px] font-semibold ${m.fromAdmin ? "ml-auto bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"}`}>
                  {m.body}
                </div>
              ))}
              {sel.messages.length === 0 && <div className="rounded-[12px] bg-slate-100 px-3 py-2 text-[12.5px] font-semibold text-slate-700">{sel.body}</div>}
            </div>
            {mutate && (
              <Field label="Reply">
                <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} className={inputCls + " resize-none"} placeholder="Type a reply…" />
              </Field>
            )}
            {mutate && <button className="mt-0 mb-1 w-full rounded-[12px] bg-emerald-600 py-2.5 text-[13px] font-extrabold text-white active:scale-95" onClick={send}>Send reply</button>}
          </>
        )}
      </Drawer>
    </>
  );
}

/* --------------------------------- Reports -------------------------------- */

export function Reports() {
  const { data } = useResource(api.kpis, []);
  const toast = useToast();
  if (!data) return <PageHeader title="Reports" subtitle="Loading…" />;
  const exportCsv = (kind: string) => toast.info("Export queued", `${kind}.csv will download once the API is live.`);
  return (
    <>
      <PageHeader title="Reports" subtitle="Platform aggregates & CSV export" />
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending deposits" value={money(data.pendingDepositValue, 0)} sub={`${data.pendingDepositCount} items`} tone="amber" />
        <StatCard label="Pending withdrawals" value={money(data.pendingWithdrawalValue, 0)} sub={`${data.pendingWithdrawalCount} items`} tone="amber" />
        <StatCard label="Net P&L today" value={money(data.netPnlToday)} tone={data.netPnlToday >= 0 ? "green" : "red"} />
        <StatCard label="KYC verified" value={`${data.verifiedPct}%`} sub={`${data.activeUsers} active`} tone="green" />
      </div>
      <div className="neu mt-3 rounded-[18px] bg-white p-4">
        <h3 className="mb-2 text-[13px] font-extrabold text-slate-800">Data exports</h3>
        <div className="flex flex-wrap gap-2">
          {["users", "deposits", "withdrawals", "positions", "ledger"].map((k) => (
            <button key={k} onClick={() => exportCsv(k)} className="neu-sm rounded-[12px] bg-white px-3.5 py-2 text-[12.5px] font-extrabold capitalize text-emerald-700 active:scale-95">
              ⬇ {k}.csv
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] font-medium text-slate-400">Exports stream from <span className="font-mono">/admin/api/reports/export/:kind.csv</span> once the API is live.</p>
      </div>
    </>
  );
}

/* --------------------------------- Settings -------------------------------- */

/** Editable copy of the platform config: numeric fields kept as raw strings so a
 *  half-typed value (e.g. "5." or "") never gets coerced mid-edit. */
interface Draft {
  minDeposit: string;
  maxDeposit: string;
  minWithdrawal: string;
  maxWithdrawal: string;
  dailyWithdrawalCap: string;
  defaultDepositBonus: string;
  maxBonus: string;
  kycRequiredToWithdraw: boolean;
  maxOpenPositionsPerUser: string;
  defaultPayoutPct: string;
}

type NumericKey = Exclude<keyof Draft, "kycRequiredToWithdraw">;

const toDraft = (s: PlatformSettings): Draft => ({
  minDeposit: String(s.minDeposit),
  maxDeposit: String(s.maxDeposit),
  minWithdrawal: String(s.minWithdrawal),
  maxWithdrawal: String(s.maxWithdrawal),
  dailyWithdrawalCap: String(s.dailyWithdrawalCap),
  defaultDepositBonus: String(s.defaultDepositBonus),
  maxBonus: String(s.maxBonus),
  kycRequiredToWithdraw: s.kycRequiredToWithdraw,
  maxOpenPositionsPerUser: String(s.maxOpenPositionsPerUser),
  defaultPayoutPct: String(s.defaultPayoutPct),
});

const toSettings = (d: Draft): PlatformSettings => ({
  minDeposit: Number(d.minDeposit),
  maxDeposit: Number(d.maxDeposit),
  minWithdrawal: Number(d.minWithdrawal),
  maxWithdrawal: Number(d.maxWithdrawal),
  dailyWithdrawalCap: Number(d.dailyWithdrawalCap),
  defaultDepositBonus: Number(d.defaultDepositBonus),
  maxBonus: Number(d.maxBonus),
  kycRequiredToWithdraw: d.kycRequiredToWithdraw,
  maxOpenPositionsPerUser: Number(d.maxOpenPositionsPerUser),
  defaultPayoutPct: Number(d.defaultPayoutPct),
});

/** per-field validation; returns a field→message map (empty when all valid) */
function validate(d: Draft): Partial<Record<keyof Draft, string>> {
  const e: Partial<Record<keyof Draft, string>> = {};
  const n = (v: string) => Number(v);
  const pos = (v: string) => v.trim() !== "" && Number.isFinite(n(v)) && n(v) > 0;
  if (!pos(d.minDeposit)) e.minDeposit = "Enter an amount greater than 0";
  if (!pos(d.maxDeposit)) e.maxDeposit = "Enter an amount greater than 0";
  if (!pos(d.minWithdrawal)) e.minWithdrawal = "Enter an amount greater than 0";
  if (!pos(d.maxWithdrawal)) e.maxWithdrawal = "Enter an amount greater than 0";
  if (!pos(d.dailyWithdrawalCap)) e.dailyWithdrawalCap = "Enter an amount greater than 0";
  if (!e.minDeposit && !e.maxDeposit && n(d.maxDeposit) < n(d.minDeposit)) e.maxDeposit = "Must be ≥ minimum deposit";
  if (!e.minWithdrawal && !e.maxWithdrawal && n(d.maxWithdrawal) < n(d.minWithdrawal)) e.maxWithdrawal = "Must be ≥ minimum withdrawal";
  if (!e.maxWithdrawal && !e.dailyWithdrawalCap && n(d.dailyWithdrawalCap) < n(d.maxWithdrawal)) e.dailyWithdrawalCap = "Must be ≥ maximum withdrawal";
  if (d.defaultDepositBonus.trim() === "" || n(d.defaultDepositBonus) < 0 || n(d.defaultDepositBonus) > 500) e.defaultDepositBonus = "0 – 500%";
  if (d.maxBonus.trim() === "" || n(d.maxBonus) < 0) e.maxBonus = "Cannot be negative";
  if (!pos(d.maxOpenPositionsPerUser) || n(d.maxOpenPositionsPerUser) > 200) e.maxOpenPositionsPerUser = "1 – 200";
  if (!pos(d.defaultPayoutPct) || n(d.defaultPayoutPct) > 100) e.defaultPayoutPct = "1 – 100%";
  return e;
}

export function Settings() {
  const { session, refresh } = useAdmin();
  const toast = useToast();
  const { loading, data } = useResource(api.settings, []);
  const mutate = can(session?.role ?? "READONLY", "mutate");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  // seed the draft from the loaded config (and re-seed whenever it changes externally)
  useEffect(() => {
    if (data) setDraft(toDraft(data));
  }, [data]);

  const errors = useMemo(() => (draft ? validate(draft) : {}), [draft]);
  const invalid = Object.keys(errors).length > 0;
  const dirty = !!draft && !!data && JSON.stringify(toSettings(draft)) !== JSON.stringify(data);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));
  const num = (key: NumericKey) => (e: ChangeEvent<HTMLInputElement>) => set(key, e.target.value.replace(/[^0-9.]/g, ""));

  const save = async () => {
    if (!draft || invalid) return;
    setSaving(true);
    try {
      await api.saveSettings(toSettings(draft));
      toast.success("Settings saved", "Platform configuration updated");
      refresh();
    } catch (err) {
      toast.error("Save failed", (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const groupCls = "neu rounded-[16px] bg-white p-3.5";
  const headCls = "mb-2.5 text-[12px] font-extrabold uppercase tracking-wide text-slate-500";

  if (loading || !draft) return <><PageHeader title="Settings" subtitle="Loading…" /></>;

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Platform-wide limits, bonus and risk rules"
        actions={dirty ? <Badge label="unsigned changes" tone="amber" /> : <Badge label="saved" tone="green" />}
      />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className={groupCls}>
          <h3 className={headCls}>Limits</h3>
          <div className="grid grid-cols-2 gap-x-2.5">
            <SettingNumber label="Min deposit" prefix="$" value={draft.minDeposit} onChange={num("minDeposit")} error={errors.minDeposit} disabled={!mutate} />
            <SettingNumber label="Max deposit" prefix="$" value={draft.maxDeposit} onChange={num("maxDeposit")} error={errors.maxDeposit} disabled={!mutate} />
            <SettingNumber label="Min withdrawal" prefix="$" value={draft.minWithdrawal} onChange={num("minWithdrawal")} error={errors.minWithdrawal} disabled={!mutate} />
            <SettingNumber label="Max withdrawal" prefix="$" value={draft.maxWithdrawal} onChange={num("maxWithdrawal")} error={errors.maxWithdrawal} disabled={!mutate} />
          </div>
          <SettingNumber label="Daily withdrawal cap" prefix="$" value={draft.dailyWithdrawalCap} onChange={num("dailyWithdrawalCap")} error={errors.dailyWithdrawalCap} disabled={!mutate} />
        </div>

        <div className={groupCls}>
          <h3 className={headCls}>Bonus</h3>
          <SettingNumber label="Default deposit bonus" suffix="%" value={draft.defaultDepositBonus} onChange={num("defaultDepositBonus")} error={errors.defaultDepositBonus} disabled={!mutate} />
          <SettingNumber label="Max bonus" prefix="$" value={draft.maxBonus} onChange={num("maxBonus")} error={errors.maxBonus} disabled={!mutate} />
        </div>

        <div className={groupCls}>
          <h3 className={headCls}>Risk</h3>
          <ToggleRow label="KYC required to withdraw" checked={draft.kycRequiredToWithdraw} onChange={(v) => set("kycRequiredToWithdraw", v)} disabled={!mutate} />
          <SettingNumber label="Max open positions / user" value={draft.maxOpenPositionsPerUser} onChange={num("maxOpenPositionsPerUser")} error={errors.maxOpenPositionsPerUser} disabled={!mutate} />
          <SettingNumber label="Payout default" suffix="%" value={draft.defaultPayoutPct} onChange={num("defaultPayoutPct")} error={errors.defaultPayoutPct} disabled={!mutate} />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-slate-400">
          {mutate ? "Changes are applied to new deposits, withdrawals and trades." : "Your role can view but not edit platform settings."}
        </p>
        <div className="flex gap-2">
          <button
            disabled={!mutate || !dirty || saving}
            onClick={() => data && setDraft(toDraft(data))}
            className="neu-sm rounded-[12px] bg-white px-4 py-2.5 text-[13px] font-extrabold text-slate-600 active:scale-95 disabled:opacity-40"
          >
            Reset
          </button>
          <button
            disabled={!mutate || !dirty || invalid || saving}
            onClick={save}
            className="rounded-[12px] bg-emerald-600 px-5 py-2.5 text-[13px] font-extrabold text-white active:scale-95 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </>
  );
}

function SettingNumber({
  label,
  value,
  onChange,
  prefix,
  suffix,
  error,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  prefix?: string;
  suffix?: string;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <label className="mb-2.5 block">
      <span className="mb-1 block text-[11.5px] font-bold text-slate-600">{label}</span>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-[13px] font-extrabold text-slate-400">{prefix}</span>}
        <input
          value={value}
          onChange={onChange}
          disabled={disabled}
          inputMode="decimal"
          className={
            inputCls +
            " text-right tabular-nums disabled:bg-slate-50 " +
            (error ? "ring-2 ring-rose-300" : "")
          }
        />
        {suffix && <span className="text-[13px] font-extrabold text-slate-400">{suffix}</span>}
      </div>
      {error && <span className="mt-1 block text-[10.5px] font-semibold text-rose-500">{error}</span>}
    </label>
  );
}

function ToggleRow({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <span className="text-[11.5px] font-bold text-slate-600">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${checked ? "bg-emerald-500" : "bg-slate-300"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

/* ---------------------------------- Staff --------------------------------- */

export function Staff() {
  const { loading, data } = useResource(api.adminUsers, []);
  const cols: Column<AdminUser>[] = [
    { key: "name", header: "Name", cell: (a) => <span className="font-extrabold text-slate-900">{a.name}</span> },
    { key: "email", header: "Email", hideOnTablet: true, cell: (a) => <span className="text-slate-500">{a.email}</span> },
    { key: "role", header: "Role", align: "center", cell: (a) => <Badge label={a.role.replace("_", " ")} tone="blue" /> },
    { key: "active", header: "State", align: "center", cell: (a) => <Badge label={a.active ? "ON" : "OFF"} tone={a.active ? "green" : "slate"} /> },
    { key: "lastSeenAt", header: "Last seen", align: "right", hideOnTablet: true, cell: (a) => <span className="text-slate-400">{a.lastSeenAt ? shortDate(a.lastSeenAt) : "—"}</span> },
  ];
  return (
    <>
      <PageHeader title="Staff" subtitle="Console users & their role" />
      <DataTable rows={data ?? []} columns={cols} getId={(a) => a.id} mobileKeys={["name", "role", "active"]} loading={loading} />
    </>
  );
}

/* ---------------------------------- Roles --------------------------------- */

const MATRIX: Record<string, string[]> = {
  SUPER_ADMIN: ["all"],
  FINANCE: ["wallets", "gateways", "reconciliation", "reports"],
  OPS: ["users", "kyc", "trades", "markets"],
  SUPPORT: ["tickets"],
  READONLY: ["view only"],
};

export function Roles() {
  return (
    <>
      <PageHeader title="Roles & Permissions" subtitle="What each console role can reach" />
      <div className="space-y-2">
        {Object.entries(MATRIX).map(([role, perms]) => (
          <div key={role} className="neu flex flex-col gap-1.5 rounded-[14px] bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <Badge label={role.replace("_", " ")} tone="blue" />
            <div className="flex flex-wrap gap-1.5">
              {perms.map((p) => (
                <span key={p} className="rounded-[8px] bg-slate-100 px-2 py-0.5 text-[11px] font-bold capitalize text-slate-600">{p}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------------------------------- Audit --------------------------------- */

export function Audit() {
  const { loading, data } = useResource(api.audit, []);
  const cols: Column<AuditLog>[] = [
    { key: "admin", header: "Admin", cell: (a) => <span className="font-extrabold text-slate-900">{a.admin}</span> },
    { key: "action", header: "Action", cell: (a) => <span className="font-mono text-[11.5px] text-slate-600">{a.action}</span> },
    { key: "entity", header: "Entity", align: "center", hideOnTablet: true, cell: (a) => <Badge label={a.entity} tone="violet" /> },
    { key: "entityId", header: "Ref", align: "center", hideOnTablet: true, cell: (a) => <span className="text-slate-400">{a.entityId}</span> },
    { key: "ip", header: "IP", align: "right", hideOnTablet: true, cell: (a) => <span className="text-slate-400">{a.ip}</span> },
    { key: "createdAt", header: "When", align: "right", cell: (a) => <span className="text-slate-400">{shortDate(a.createdAt)}</span> },
  ];
  return (
    <>
      <PageHeader title="Audit Log" subtitle="Every mutating console action" />
      <DataTable rows={data ?? []} columns={cols} getId={(a) => a.id} mobileKeys={["admin", "action", "createdAt"]} loading={loading} />
    </>
  );
}
