import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { api, can } from "../api";
import { useAdmin, useResource } from "../AdminStore";
import { DataTable, type Column } from "../DataTable";
import { Drawer, Field, inputCls } from "../sheets";
import { Badge, EmptyState, PageHeader, StatCard, StatusPills, shortDate, type Tone } from "../ui";
import { useToast } from "../../components/Toast";
import type { EmailLogEntry, EmailSettings, EmailTemplate } from "../types";

type Tab = "templates" | "outbox" | "config";

const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500";

/* --------------------------------- Emails --------------------------------- */

export function Emails() {
  const [tab, setTab] = useState<Tab>("templates");
  return (
    <>
      <PageHeader
        title="Emails"
        subtitle="Automatic emails, templates & the SMTP transport that sends them"
        actions={
          <StatusPills
            value={tab}
            onChange={setTab}
            options={[
              { label: "Templates", value: "templates" },
              { label: "Outbox", value: "outbox" },
              { label: "Configuration", value: "config" },
            ]}
          />
        }
      />
      {tab === "templates" && <TemplatesTab />}
      {tab === "outbox" && <OutboxTab />}
      {tab === "config" && <ConfigTab />}
    </>
  );
}

/* ------------------------------- Templates ------------------------------- */

function TemplatesTab() {
  const { session, refresh } = useAdmin();
  const toast = useToast();
  const { loading, data } = useResource(api.emailTemplates, []);
  const [sel, setSel] = useState<EmailTemplate | null>(null);
  const mutate = can(session?.role ?? "READONLY", "mutate");

  const rows = useMemo(() => data ?? [], [data]);
  const active = rows.filter((t) => t.enabled).length;

  const toggle = async (t: EmailTemplate) => {
    await api.toggleEmailTemplate(t.key);
    toast.info(t.enabled ? "Template disabled" : "Template enabled", t.name);
    refresh();
  };

  if (loading && rows.length === 0) return <p className="py-10 text-center text-[13px] font-bold text-slate-400">Loading templates…</p>;

  return (
    <>
      <div className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <StatCard label="Templates" value={rows.length} sub={`${active} enabled`} tone="green" />
        <StatCard label="Triggered automatically" value={rows.filter((t) => t.enabled).length} sub="fired by platform events" tone="blue" />
        <StatCard label="Disabled" value={rows.length - active} sub="will not send" tone="slate" />
      </div>

      <div className="mb-3 rounded-[14px] bg-[#e8f0fe] px-3.5 py-2.5 text-[11.5px] font-semibold text-sky-700">
        Each template fires on its event with no manual step — e.g. <span className="font-mono">DEPOSIT_CONFIRMED</span> sends the moment a deposit is credited. Toggle one off to pause just that email.
      </div>

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((t) => (
          <div key={t.key} className="neu flex flex-col rounded-[16px] bg-white p-3.5">
            <div className="mb-1.5 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-extrabold text-slate-900">{t.name}</div>
                <div className="font-mono text-[10.5px] font-bold text-slate-400">{t.key}</div>
              </div>
              <Badge label={t.enabled ? "ON" : "OFF"} tone={t.enabled ? "green" : "slate"} />
            </div>
            <Badge label={t.category} tone="violet" />
            <p className="mt-2 flex-1 text-[11.5px] font-medium text-slate-500">{t.description}</p>
            <div className="mt-2 rounded-[10px] bg-[#f7f9fc] px-2.5 py-2 text-[11.5px] font-bold text-slate-700">{t.subject}</div>
            <div className="mt-2.5 flex gap-2">
              <button onClick={() => setSel(t)} className="flex-1 rounded-[10px] bg-slate-800 py-2 text-[12px] font-extrabold text-white active:scale-95">Edit</button>
              {mutate && (
                <button onClick={() => toggle(t)} className="flex-1 rounded-[10px] bg-slate-100 py-2 text-[12px] font-extrabold text-slate-600 active:scale-95">
                  {t.enabled ? "Disable" : "Enable"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <TemplateDrawer template={sel} readOnly={!mutate} onClose={() => setSel(null)} onSaved={refresh} />
    </>
  );
}

function TemplateDrawer({ template, readOnly, onClose, onSaved }: { template: EmailTemplate | null; readOnly: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [draft, setDraft] = useState<EmailTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(template ? { ...template } : null);
  }, [template]);

  const set = (patch: Partial<EmailTemplate>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const invalid = !draft || !draft.name.trim() || !draft.subject.trim() || !draft.body.trim();

  const save = async () => {
    if (!draft || invalid) return;
    setSaving(true);
    try {
      await api.saveEmailTemplate(draft);
      toast.success("Template saved", draft.name);
      onSaved();
      onClose();
    } catch (e) {
      toast.error("Save failed", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const preview = draft ? renderPreview(draft.subject, sampleVars(draft.variables)) : "";
  const previewBody = draft ? renderPreview(draft.body, sampleVars(draft.variables)) : "";

  return (
    <Drawer
      open={!!template}
      onClose={onClose}
      title={draft?.name ?? ""}
      subtitle={draft ? `${draft.key} · ${draft.category}` : ""}
      footer={
        draft && !readOnly ? (
          <button
            onClick={save}
            disabled={saving || invalid}
            className="mt-0 w-full rounded-[12px] bg-emerald-600 py-2.5 text-[13px] font-extrabold text-white active:scale-95 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save template"}
          </button>
        ) : undefined
      }
    >
      {draft && (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-[12px] bg-[#f7f9fc] px-3 py-2.5">
            <div>
              <div className="text-[12px] font-extrabold text-slate-700">Send automatically</div>
              <div className="text-[10.5px] font-medium text-slate-400">{draft.description}</div>
            </div>
            <Toggle checked={draft.enabled} disabled={readOnly} onChange={(v) => set({ enabled: v })} label="Send automatically" />
          </div>

          <Field label="Name">
            <input className={inputCls} disabled={readOnly} value={draft.name} onChange={(e) => set({ name: e.target.value })} />
          </Field>

          <Field label="Subject">
            <input className={inputCls} disabled={readOnly} value={draft.subject} onChange={(e) => set({ subject: e.target.value })} />
          </Field>

          <Field label="Body" hint="Plain text with {{variable}} placeholders.">
            <textarea
              value={draft.body}
              disabled={readOnly}
              onChange={(e) => set({ body: e.target.value })}
              rows={9}
              className={inputCls + " resize-none font-mono text-[12.5px]"}
            />
          </Field>

          <div>
            <span className={labelCls}>Available variables</span>
            <div className="flex flex-wrap gap-1.5">
              {draft.variables.map((v) => (
                <button
                  key={v}
                  disabled={readOnly}
                  onClick={() => set({ body: `${draft.body}{{${v}}}` })}
                  className="rounded-[8px] bg-[#efeafe] px-2 py-0.5 font-mono text-[11px] font-bold text-violet-700 active:scale-95 disabled:opacity-60"
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10.5px] font-medium text-slate-400">Tap a variable to insert it into the body.</p>
          </div>

          <div className="rounded-[12px] bg-white p-3 ring-1 ring-slate-100">
            <div className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Preview</div>
            <div className="border-b border-slate-100 pb-1.5 text-[13px] font-extrabold text-slate-800">{preview}</div>
            <p className="mt-1.5 whitespace-pre-wrap text-[12px] font-medium text-slate-600">{previewBody}</p>
          </div>
        </div>
      )}
    </Drawer>
  );
}

/* -------------------------------- Outbox --------------------------------- */

function OutboxTab() {
  const { session, refresh } = useAdmin();
  const toast = useToast();
  const { loading, data } = useResource(api.emailLog, []);
  const { data: templates } = useResource(api.emailTemplates, []);
  const [to, setTo] = useState("");
  const [tpl, setTpl] = useState("");
  const [sending, setSending] = useState(false);
  const mutate = can(session?.role ?? "READONLY", "mutate");

  const rows = data ?? [];
  const list = templates ?? [];

  useEffect(() => {
    if (!tpl && list.length) setTpl(list[0].key);
  }, [list, tpl]); // eslint-disable-line react-hooks/exhaustive-deps

  const sent = rows.filter((r) => r.status === "SENT").length;
  const failed = rows.filter((r) => r.status === "FAILED").length;

  const send = async () => {
    if (!to.trim() || !tpl) return;
    setSending(true);
    try {
      await api.sendTestEmail(to.trim(), tpl);
      toast.success("Test email sent", `to ${to.trim()}`);
      setTo("");
      refresh();
    } catch (e) {
      toast.error("Send failed", (e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const cols: Column<EmailLogEntry>[] = [
    { key: "to", header: "Recipient", cell: (r) => <span className="font-extrabold text-slate-900">{r.to}</span> },
    { key: "template", header: "Template", align: "center", hideOnTablet: true, cell: (r) => <span className="font-mono text-[11px] text-slate-500">{r.template}</span> },
    { key: "subject", header: "Subject", hideOnTablet: true, cell: (r) => <span className="text-slate-500">{r.subject}</span> },
    { key: "status", header: "Status", align: "center", cell: (r) => <Badge label={r.status} tone={emailTone(r.status)} /> },
    { key: "createdAt", header: "When", align: "right", cell: (r) => <span className="text-slate-400">{shortDate(r.createdAt)}</span> },
  ];

  return (
    <>
      <div className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <StatCard label="Sent" value={sent} tone="green" />
        <StatCard label="Failed" value={failed} tone={failed ? "red" : "slate"} />
        <StatCard label="Total" value={rows.length} tone="blue" />
      </div>

      {mutate && (
        <div className="neu mb-3 rounded-[16px] bg-white p-3.5">
          <h3 className="mb-2 text-[12px] font-extrabold uppercase tracking-wide text-slate-500">Send a test email</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1.4fr_1fr_auto] sm:items-end">
            <Field label="Recipient">
              <input className={inputCls} type="email" placeholder="you@example.com" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
            <Field label="Template">
              <select className={inputCls} value={tpl} onChange={(e) => setTpl(e.target.value)}>
                {list.map((t) => (
                  <option key={t.key} value={t.key}>{t.name}</option>
                ))}
              </select>
            </Field>
            <button
              onClick={send}
              disabled={sending || !to.trim() || !tpl}
              className="h-[44px] rounded-[12px] bg-emerald-600 px-5 text-[13px] font-extrabold text-white active:scale-95 disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
          <p className="mt-2 text-[10.5px] font-medium text-slate-400">Renders the template with sample data and delivers it through the configured SMTP transport.</p>
        </div>
      )}

      {rows.length === 0 && !loading ? (
        <EmptyState title="No emails yet" hint="Automatic emails will appear here as they are sent." />
      ) : (
        <DataTable rows={rows} columns={cols} getId={(r) => r.id} mobileKeys={["to", "status", "createdAt"]} loading={loading} />
      )}
    </>
  );
}

/* ----------------------------- Configuration ----------------------------- */

interface SettingsDraft {
  enabled: boolean;
  host: string;
  port: string;
  secure: boolean;
  username: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  passwordSet: boolean;
}

const toDraft = (s: EmailSettings): SettingsDraft => ({ ...s, port: String(s.port) });

function validate(d: SettingsDraft) {
  const e: Partial<Record<keyof SettingsDraft, string>> = {};
  if (!d.host.trim()) e.host = "SMTP host is required";
  const port = Number(d.port);
  if (!d.port.trim() || !Number.isInteger(port) || port < 1 || port > 65535) e.port = "1 – 65535";
  if (!d.fromEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.fromEmail.trim())) e.fromEmail = "Valid from-address required";
  if (d.replyTo.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.replyTo.trim())) e.replyTo = "Enter a valid address";
  return e;
}

function ConfigTab() {
  const { session, refresh } = useAdmin();
  const toast = useToast();
  const { loading, data } = useResource(api.emailSettings, []);
  const mutate = can(session?.role ?? "READONLY", "mutate");
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (data) setDraft(toDraft(data));
  }, [data]);

  const errors = useMemo(() => (draft ? validate(draft) : {}), [draft]);
  const invalid = Object.keys(errors).length > 0;

  const set = <K extends keyof SettingsDraft>(k: K, v: SettingsDraft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const dirty = !!draft && !!data && (JSON.stringify({ ...toDraft(data), passwordSet: false }) !== JSON.stringify({ ...draft, passwordSet: false }) || password.trim().length > 0);

  const save = async () => {
    if (!draft || invalid) return;
    setSaving(true);
    try {
      const next: EmailSettings = {
        enabled: draft.enabled,
        host: draft.host.trim(),
        port: Number(draft.port),
        secure: draft.secure,
        username: draft.username.trim(),
        fromName: draft.fromName.trim(),
        fromEmail: draft.fromEmail.trim(),
        replyTo: draft.replyTo.trim(),
        passwordSet: draft.passwordSet,
      };
      await api.saveEmailSettings(next, password);
      setPassword("");
      toast.success("Email configuration saved", next.host);
      refresh();
    } catch (e) {
      toast.error("Save failed", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    const r = await api.testEmailConnection();
    if (r.ok) toast.success("SMTP reachable", r.message);
    else toast.error("Connection failed", r.message);
    setTesting(false);
  };

  if (loading || !draft) return <p className="py-10 text-center text-[13px] font-bold text-slate-400">Loading configuration…</p>;

  const groupCls = "neu rounded-[16px] bg-white p-3.5";
  const headCls = "mb-2.5 text-[12px] font-extrabold uppercase tracking-wide text-slate-500";

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className={groupCls}>
          <h3 className={headCls}>Automatic email</h3>
          <div className="flex items-center justify-between rounded-[12px] bg-[#f7f9fc] px-3 py-2.5">
            <div>
              <div className="text-[12px] font-extrabold text-slate-700">Send automatic emails</div>
              <div className="text-[10.5px] font-medium text-slate-400">Master switch — pauses every transactional email.</div>
            </div>
            <Toggle checked={draft.enabled} disabled={!mutate} onChange={(v) => set("enabled", v)} label="Send automatic emails" />
          </div>
          <div className="mt-3 space-y-2">
            <Field label="From name">
              <input className={inputCls} disabled={!mutate} placeholder="Luxytrades" value={draft.fromName} onChange={(e) => set("fromName", e.target.value)} />
            </Field>
            <Field label="From email">
              <input className={inputCls + (errors.fromEmail ? " ring-2 ring-rose-300" : "")} disabled={!mutate} placeholder="no-reply@luxytrades.io" value={draft.fromEmail} onChange={(e) => set("fromEmail", e.target.value)} />
              {errors.fromEmail && <span className="mt-1 block text-[10.5px] font-semibold text-rose-500">{errors.fromEmail}</span>}
            </Field>
            <Field label="Reply-to (optional)">
              <input className={inputCls + (errors.replyTo ? " ring-2 ring-rose-300" : "")} disabled={!mutate} placeholder="support@luxytrades.io" value={draft.replyTo} onChange={(e) => set("replyTo", e.target.value)} />
              {errors.replyTo && <span className="mt-1 block text-[10.5px] font-semibold text-rose-500">{errors.replyTo}</span>}
            </Field>
          </div>
        </div>

        <div className={groupCls}>
          <h3 className={headCls}>SMTP transport</h3>
          <Field label="Host">
            <input className={inputCls + (errors.host ? " ring-2 ring-rose-300" : "")} disabled={!mutate} placeholder="smtp.mailgun.org" value={draft.host} onChange={(e) => set("host", e.target.value)} />
            {errors.host && <span className="mt-1 block text-[10.5px] font-semibold text-rose-500">{errors.host}</span>}
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Port">
              <input className={inputCls + " text-right tabular-nums" + (errors.port ? " ring-2 ring-rose-300" : "")} inputMode="numeric" disabled={!mutate} placeholder="587" value={draft.port} onChange={(e: ChangeEvent<HTMLInputElement>) => set("port", e.target.value.replace(/[^0-9]/g, ""))} />
            </Field>
            <Field label="Encryption">
              <select className={inputCls} disabled={!mutate} value={draft.secure ? "tls" : "starttls"} onChange={(e) => set("secure", e.target.value === "tls")}>
                <option value="starttls">STARTTLS (587)</option>
                <option value="tls">Implicit TLS (465)</option>
              </select>
            </Field>
          </div>
          {errors.port && <span className="-mt-2 mb-2 block text-[10.5px] font-semibold text-rose-500">{errors.port}</span>}
          <Field label="Username">
            <input className={inputCls} disabled={!mutate} autoComplete="off" placeholder="postmaster@luxytrades.io" value={draft.username} onChange={(e) => set("username", e.target.value)} />
          </Field>
        </div>

        <div className={groupCls}>
          <h3 className={headCls}>Credentials</h3>
          <div className="rounded-[12px] bg-[#f7f9fc] p-3">
            <label className={labelCls}>SMTP password {draft.passwordSet && <span className="text-emerald-600">• set</span>}</label>
            <input
              type="password"
              className={inputCls}
              disabled={!mutate}
              autoComplete="new-password"
              placeholder={draft.passwordSet ? "•••••• (unchanged)" : "enter password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="mt-2 text-[10.5px] font-medium text-slate-400">Stored AES-256-GCM encrypted and never re-displayed. Leave blank to keep the existing password.</p>
          </div>
          <button
            onClick={test}
            disabled={testing}
            className="neu-sm mt-3 w-full rounded-[12px] bg-white py-2.5 text-[13px] font-extrabold text-slate-700 active:scale-95 disabled:opacity-50"
          >
            {testing ? "Testing…" : "Test connection"}
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-slate-400">
          {mutate ? "Automatic emails are delivered through this SMTP transport." : "Your role can view but not edit email configuration."}
        </p>
        <div className="flex gap-2">
          <button
            disabled={!mutate || !dirty || saving}
            onClick={() => { if (data) setDraft(toDraft(data)); setPassword(""); }}
            className="neu-sm rounded-[12px] bg-white px-4 py-2.5 text-[13px] font-extrabold text-slate-600 active:scale-95 disabled:opacity-40"
          >
            Reset
          </button>
          <button
            disabled={!mutate || !dirty || invalid || saving}
            onClick={save}
            className="rounded-[12px] bg-emerald-600 px-5 py-2.5 text-[13px] font-extrabold text-white active:scale-95 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save configuration"}
          </button>
        </div>
      </div>
    </>
  );
}

/* -------------------------------- helpers -------------------------------- */

function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
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
  );
}

function emailTone(status: EmailLogEntry["status"]): Tone {
  return status === "SENT" ? "green" : status === "FAILED" ? "red" : "amber";
}

/** Sample values for the template preview / test render. */
function sampleVars(vars: string[]): Record<string, string> {
  const samples: Record<string, string> = {
    name: "Grace",
    email: "grace@example.com",
    amount: "300.00",
    method: "M-Pesa",
    reference: "RT4M2NQXK0",
    destination: "0712345678",
    balance: "12,450.80",
    reason: "Blurred document photo",
    link: "https://luxytrades.io/reset/abc123",
  };
  return Object.fromEntries(vars.map((v) => [v, samples[v] ?? `{{${v}}}`]));
}

const renderPreview = (text: string, vars: Record<string, string>): ReactNode =>
  text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => vars[k] ?? `{{${k}}}`);
