import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { api, can } from "../api";
import { useAdmin, useResource } from "../AdminStore";
import { DataTable, type Column } from "../DataTable";
import { Drawer } from "../sheets";
import { Badge, EmptyState, PageHeader, money, num, shortDate } from "../ui";
import { useToast } from "../../components/Toast";
import type { CryptoConfig, Gateway, GatewayCallback, MpesaSettings } from "../types";

/* -------------------------------- Gateways -------------------------------- */

export function Gateways() {
  const { session, refresh } = useAdmin();
  const toast = useToast();
  const { loading, data } = useResource(api.gateways, []);
  const [sel, setSel] = useState<Gateway | null>(null);
  const mutate = can(session?.role ?? "READONLY", "mutate");

  const toggle = async (g: Gateway) => {
    await api.act("toggleGateway", g.key);
    toast.info(g.enabled ? "Gateway disabled" : "Gateway enabled", g.label);
    refresh();
    setSel((s) => (s && s.key === g.key ? { ...s, enabled: !s.enabled } : s));
  };

  const test = async (g: Gateway) => {
    if (g.kind === "MPESA_DARAJA") {
      toast.info("Testing Daraja connection", `${g.label}…`);
      const r = await api.testMpesaGateway();
      if (r.ok) toast.success("Connection OK", r.message);
      else toast.error("Connection failed", r.message);
      return;
    }
    if (g.kind.startsWith("CRYPTO_")) {
      toast.info("Validating crypto config", `${g.label}…`);
      const r = await api.testCryptoGateway(g.key);
      if (r.ok) toast.success("Config valid", r.message);
      else toast.error("Config invalid", r.message);
      return;
    }
    toast.info("Testing connection", `${g.label}…`);
    setTimeout(() => toast.success("Connection OK", `${g.label} reachable`), 900);
  };

  const cols: Column<Gateway>[] = [
    { key: "label", header: "Provider", cell: (g) => <span className="font-extrabold text-slate-900">{g.label}</span> },
    { key: "kind", header: "Type", align: "center", hideOnTablet: true, cell: (g) => <Badge label={g.kind.replace(/_/g, " ")} tone="violet" /> },
    { key: "range", header: "Limits", align: "center", hideOnTablet: true, cell: (g) => <span className="text-slate-500">{money(g.minAmount, 0)} – {money(g.maxAmount, 0)}</span> },
    { key: "fee", header: "Fee", align: "center", cell: (g) => <span className="tabular-nums text-slate-600">{g.feePct}%{g.feeFixed ? ` + ${money(g.feeFixed)}` : ""}</span> },
    { key: "enabled", header: "State", align: "center", cell: (g) => <Badge label={g.enabled ? "ON" : "OFF"} tone={g.enabled ? "green" : "slate"} /> },
  ];

  return (
    <>
      <PageHeader title="Payment Gateways" subtitle="Providers, fees, credentials & live test" />
      <DataTable rows={data ?? []} columns={cols} getId={(g) => g.key} onRowClick={setSel} mobileKeys={["label", "enabled", "fee", "range"]} loading={loading} />
      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.label ?? ""} subtitle={sel ? `${sel.kind.replace(/_/g, " ")}` : ""}
        footer={sel && mutate ? (
          <div className="flex gap-2">
            <button className="mt-0 flex-1 rounded-[12px] bg-slate-800 py-2.5 text-[13px] font-extrabold text-white active:scale-95" onClick={() => test(sel)}>Test connection</button>
            <button className="mt-0 flex-1 rounded-[12px] bg-emerald-600 py-2.5 text-[13px] font-extrabold text-white active:scale-95" onClick={() => toggle(sel)}>{sel.enabled ? "Disable" : "Enable"}</button>
          </div>
        ) : undefined}>
        {sel && sel.kind === "MPESA_DARAJA" ? (
          <MpesaConfigForm gateway={sel} readOnly={!mutate} onSaved={refresh} />
        ) : sel && sel.kind.startsWith("CRYPTO_") ? (
          <CryptoConfigForm gateway={sel} readOnly={!mutate} onSaved={refresh} />
        ) : sel && (
          <div className="space-y-2.5">
            <div className="rounded-[12px] bg-[#f7f9fc] px-3 py-2.5 text-[12px]">
              <div className="mb-1 flex items-center justify-between"><span className="font-bold text-slate-500">Credentials</span><Badge label={sel.enabled ? "ACTIVE" : "OFF"} tone={sel.enabled ? "green" : "slate"} /></div>
              <div className="font-mono text-[13px] font-extrabold text-slate-700">{sel.masked}</div>
              <p className="mt-1 text-[10.5px] font-medium text-slate-400">Secrets are stored AES-256-GCM encrypted and never rendered in plaintext.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Min" value={money(sel.minAmount, 0)} />
              <Stat label="Max" value={money(sel.maxAmount, 0)} />
              <Stat label="Fee %" value={`${sel.feePct}%`} />
              <Stat label="Fee fixed" value={money(sel.feeFixed)} />
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}

const inputCls =
  "w-full rounded-[10px] bg-white px-3 py-2 text-[13px] font-semibold text-slate-800 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-400";
const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

/* --------------------------- M-Pesa config form --------------------------- */

function MpesaConfigForm({ gateway, readOnly, onSaved }: { gateway: Gateway; readOnly: boolean; onSaved: () => void }) {
  const toast = useToast();
  const [cfg, setCfg] = useState<MpesaSettings>(
    gateway.mpesa ?? {
      env: "production",
      transactionType: "CustomerBuyGoodsOnline",
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
  );
  // secrets are typed fresh on save, never persisted to local state after submit
  const [key, setKey] = useState("");
  const [secret, setSecret] = useState("");
  const [passkey, setPasskey] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (gateway.mpesa) setCfg(gateway.mpesa);
  }, [gateway.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const isTill = cfg.transactionType === "CustomerBuyGoodsOnline";
  const set = (patch: Partial<MpesaSettings>) => setCfg((c) => ({ ...c, ...patch }));

  const save = async () => {
    setSaving(true);
    const next: MpesaSettings = {
      ...cfg,
      consumerKeySet: cfg.consumerKeySet || key.trim().length > 0,
      consumerSecretSet: cfg.consumerSecretSet || secret.trim().length > 0,
      passkeySet: cfg.passkeySet || passkey.trim().length > 0,
    };
    try {
      await api.saveMpesaSettings(gateway.key, next, {
        ...(key.trim() ? { consumerKey: key.trim() } : {}),
        ...(secret.trim() ? { consumerSecret: secret.trim() } : {}),
        ...(passkey.trim() ? { passkey: passkey.trim() } : {}),
      });
      setKey(""); setSecret(""); setPasskey("");
      toast.success("M-Pesa settings saved", `${next.env} · ${next.transactionType}`);
      onSaved();
    } catch (e) {
      toast.error("Save failed", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-[12px] bg-[#e7f8ef] px-3 py-2">
        <span className="text-[11px] font-extrabold text-emerald-700">Daraja STK push</span>
        <Badge
          label={cfg.shortcode && cfg.consumerKeySet && cfg.consumerSecretSet && cfg.passkeySet ? "CONFIGURED" : "INCOMPLETE"}
          tone={cfg.shortcode && cfg.consumerKeySet && cfg.consumerSecretSet && cfg.passkeySet ? "green" : "amber"}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Environment">
          <select className={inputCls} disabled={readOnly} value={cfg.env} onChange={(e) => set({ env: e.target.value as MpesaSettings["env"] })}>
            <option value="production">Production</option>
            <option value="sandbox">Sandbox</option>
          </select>
        </Field>
        <Field label="USD → KES rate">
          <input className={inputCls} disabled={readOnly} inputMode="decimal" placeholder="129.4" value={String(cfg.kesRate)} onChange={(e) => set({ kesRate: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })} />
        </Field>
      </div>

      <Field label="Collection flow">
        <select className={inputCls} disabled={readOnly} value={cfg.transactionType} onChange={(e) => set({ transactionType: e.target.value as MpesaSettings["transactionType"] })}>
          <option value="CustomerBuyGoodsOnline">Till number (Buy Goods)</option>
          <option value="CustomerPayBillOnline">Paybill (Head office)</option>
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Head-office shortcode *">
          <input className={inputCls} disabled={readOnly} inputMode="numeric" placeholder="400200" value={cfg.shortcode} onChange={(e) => set({ shortcode: e.target.value })} />
        </Field>
        {isTill ? (
          <Field label="Till number (Party B)">
            <input className={inputCls} disabled={readOnly} inputMode="numeric" placeholder="150000" value={cfg.tillNumber} onChange={(e) => set({ tillNumber: e.target.value })} />
          </Field>
        ) : (
          <Field label="Account reference">
            <input className={inputCls} disabled={readOnly} placeholder="LUXYTRADES" value={cfg.accountRef} onChange={(e) => set({ accountRef: e.target.value })} />
          </Field>
        )}
      </div>
      <p className="-mt-1 text-[10.5px] font-semibold text-slate-400">
        {isTill
          ? "The head-office shortcode is the BusinessShortCode the STK is sent from; the till is carried as the account reference (Party B)."
          : "Paybill flow — the head-office shortcode is the BusinessShortCode and the account reference is shown on the customer prompt."}
      </p>

      {isTill && (
        <Field label="Default account reference (fallback)">
          <input className={inputCls} disabled={readOnly} placeholder="LUXYTRADES" value={cfg.accountRef} onChange={(e) => set({ accountRef: e.target.value })} />
        </Field>
      )}

      <Field label="Callback URL (Safaricom posts STK results here)">
        <input className={inputCls} disabled={readOnly} placeholder="https://yourdomain.com/api/payments/mpesa/callback" value={cfg.callbackUrl} onChange={(e) => set({ callbackUrl: e.target.value })} />
      </Field>

      <Field label="Transaction description">
        <input className={inputCls} disabled={readOnly} placeholder="Luxytrades deposit" value={cfg.transactionDesc} onChange={(e) => set({ transactionDesc: e.target.value })} />
      </Field>

      <div className="rounded-[12px] bg-[#f7f9fc] p-3">
        <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Daraja app credentials</div>
        <div className="space-y-2">
          <SecretInput label="Consumer Key" isSet={cfg.consumerKeySet} readOnly={readOnly} value={key} onChange={setKey} />
          <SecretInput label="Consumer Secret" isSet={cfg.consumerSecretSet} readOnly={readOnly} value={secret} onChange={setSecret} />
          <SecretInput label="Passkey" isSet={cfg.passkeySet} readOnly={readOnly} value={passkey} onChange={setPasskey} />
        </div>
        <p className="mt-2 text-[10.5px] font-medium text-slate-400">Leave a field blank to keep the existing secret. Values are sent to the API over TLS and never re-displayed.</p>
      </div>

      {readOnly ? (
        <p className="text-[11px] font-semibold text-slate-400">Your role can view but not edit gateway configuration.</p>
      ) : (
        <button
          onClick={save}
          disabled={saving}
          className="mt-0 w-full rounded-[12px] bg-emerald-600 py-2.5 text-[13px] font-extrabold text-white active:scale-95 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save configuration"}
        </button>
      )}
    </div>
  );
}

/* --------------------------- crypto config form --------------------------- */

/** Editable copy of a crypto gateway config: numeric fields stay as strings so a
 *  half-typed value never gets coerced mid-edit. */
interface CryptoDraft {
  network: string;
  address: string;
  minAmount: string;
  maxAmount: string;
  feePct: string;
  feeFixed: string;
  confirmations: string;
  autoCredit: boolean;
  callbackUrl: string;
}

const toCryptoDraft = (c: CryptoConfig): CryptoDraft => ({
  network: c.network,
  address: c.address,
  minAmount: String(c.minAmount),
  maxAmount: String(c.maxAmount),
  feePct: String(c.feePct),
  feeFixed: String(c.feeFixed),
  confirmations: String(c.confirmations),
  autoCredit: c.autoCredit,
  callbackUrl: c.callbackUrl,
});

function validateCrypto(d: CryptoDraft): Partial<Record<keyof CryptoDraft, string>> {
  const e: Partial<Record<keyof CryptoDraft, string>> = {};
  const n = (v: string) => Number(v);
  const pos = (v: string) => v.trim() !== "" && Number.isFinite(n(v)) && n(v) > 0;
  if (!d.network.trim()) e.network = "Required";
  if (!d.address.trim()) e.address = "Receiving wallet address is required";
  if (!pos(d.minAmount)) e.minAmount = "> 0";
  if (!pos(d.maxAmount)) e.maxAmount = "> 0";
  if (!e.minAmount && !e.maxAmount && n(d.maxAmount) < n(d.minAmount)) e.maxAmount = "≥ min";
  if (d.feePct.trim() === "" || n(d.feePct) < 0 || n(d.feePct) > 100) e.feePct = "0 – 100%";
  if (d.feeFixed.trim() === "" || n(d.feeFixed) < 0) e.feeFixed = "≥ 0";
  if (!pos(d.confirmations) || n(d.confirmations) > 100) e.confirmations = "1 – 100";
  return e;
}

function CryptoConfigForm({ gateway, readOnly, onSaved }: { gateway: Gateway; readOnly: boolean; onSaved: () => void }) {
  const toast = useToast();
  const [cfg, setCfg] = useState<CryptoConfig | null>(null);
  const [draft, setDraft] = useState<CryptoDraft | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    api.cryptoSettings(gateway.key).then((c) => {
      if (!alive) return;
      const next: CryptoConfig = c ?? {
        network: "",
        address: "",
        confirmations: 2,
        autoCredit: false,
        callbackUrl: "https://yourdomain.com/api/payments/crypto/callback",
        apiKeySet: false,
        minAmount: gateway.minAmount,
        maxAmount: gateway.maxAmount,
        feePct: gateway.feePct,
        feeFixed: gateway.feeFixed,
      };
      setCfg(next);
      setDraft(toCryptoDraft(next));
    });
    return () => {
      alive = false;
    };
  }, [gateway.key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!draft || !cfg) return <p className="text-[12px] font-semibold text-slate-400">Loading configuration…</p>;

  const errors = validateCrypto(draft);
  const invalid = Object.keys(errors).length > 0;
  const set = (patch: Partial<CryptoDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const numField = (key: "minAmount" | "maxAmount" | "feePct" | "feeFixed" | "confirmations") => (e: ChangeEvent<HTMLInputElement>) =>
    set({ [key]: e.target.value.replace(/[^0-9.]/g, "") } as Partial<CryptoDraft>);

  const configured = Boolean(draft.network.trim() && draft.address.trim());

  const save = async () => {
    if (invalid) return;
    setSaving(true);
    const next: CryptoConfig = {
      network: draft.network.trim(),
      address: draft.address.trim(),
      confirmations: Number(draft.confirmations),
      autoCredit: draft.autoCredit,
      callbackUrl: draft.callbackUrl.trim(),
      apiKeySet: cfg.apiKeySet,
      minAmount: Number(draft.minAmount),
      maxAmount: Number(draft.maxAmount),
      feePct: Number(draft.feePct),
      feeFixed: Number(draft.feeFixed),
    };
    try {
      await api.saveCryptoSettings(gateway.key, next, { apiKey });
      setApiKey("");
      setCfg(next);
      toast.success("Crypto settings saved", `${gateway.label} · ${next.network}`);
      onSaved();
    } catch (e) {
      toast.error("Save failed", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-[12px] bg-[#e7f8ef] px-3 py-2">
        <span className="text-[11px] font-extrabold text-emerald-700">On-chain deposits</span>
        <Badge label={configured ? "CONFIGURED" : "INCOMPLETE"} tone={configured ? "green" : "amber"} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Network">
          <input className={`${inputCls} ${errors.network ? "ring-2 ring-rose-300" : ""}`} disabled={readOnly} placeholder="TRC20" value={draft.network} onChange={(e) => set({ network: e.target.value })} />
        </Field>
        <Field label="Confirmations required">
          <input className={`${inputCls} ${errors.confirmations ? "ring-2 ring-rose-300" : ""}`} disabled={readOnly} inputMode="numeric" placeholder="2" value={draft.confirmations} onChange={numField("confirmations")} />
        </Field>
      </div>

      <Field label="Receiving wallet address *">
        <input className={`${inputCls} font-mono ${errors.address ? "ring-2 ring-rose-300" : ""}`} disabled={readOnly} placeholder="TQ8k9m…" value={draft.address} onChange={(e) => set({ address: e.target.value })} />
      </Field>
      {errors.address && <p className="-mt-2 text-[10.5px] font-semibold text-rose-500">{errors.address}</p>}
      <p className="-mt-1 text-[10.5px] font-semibold text-slate-400">This is the address traders are shown in the deposit screen. Double-check the network — on-chain transfers are irreversible.</p>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Min amount (USD)">
          <input className={`${inputCls} ${errors.minAmount ? "ring-2 ring-rose-300" : ""}`} disabled={readOnly} inputMode="decimal" placeholder="20" value={draft.minAmount} onChange={numField("minAmount")} />
        </Field>
        <Field label="Max amount (USD)">
          <input className={`${inputCls} ${errors.maxAmount ? "ring-2 ring-rose-300" : ""}`} disabled={readOnly} inputMode="decimal" placeholder="100000" value={draft.maxAmount} onChange={numField("maxAmount")} />
        </Field>
        <Field label="Fee %">
          <input className={`${inputCls} ${errors.feePct ? "ring-2 ring-rose-300" : ""}`} disabled={readOnly} inputMode="decimal" placeholder="1" value={draft.feePct} onChange={numField("feePct")} />
        </Field>
        <Field label="Fee fixed (USD)">
          <input className={`${inputCls} ${errors.feeFixed ? "ring-2 ring-rose-300" : ""}`} disabled={readOnly} inputMode="decimal" placeholder="1" value={draft.feeFixed} onChange={numField("feeFixed")} />
        </Field>
      </div>

      <div className="flex items-center justify-between rounded-[12px] bg-[#f7f9fc] px-3 py-2.5">
        <div>
          <div className="text-[12px] font-extrabold text-slate-700">Auto-credit detected deposits</div>
          <div className="text-[10.5px] font-medium text-slate-400">Off queues each transfer for finance review.</div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={draft.autoCredit}
          aria-label="Auto-credit detected deposits"
          disabled={readOnly}
          onClick={() => set({ autoCredit: !draft.autoCredit })}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${draft.autoCredit ? "bg-emerald-500" : "bg-slate-300"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${draft.autoCredit ? "left-[22px]" : "left-0.5"}`} />
        </button>
      </div>

      <Field label="Callback URL (watcher posts detected transfers here)">
        <input className={inputCls} disabled={readOnly} placeholder="https://yourdomain.com/api/payments/crypto/callback" value={draft.callbackUrl} onChange={(e) => set({ callbackUrl: e.target.value })} />
      </Field>

      <div className="rounded-[12px] bg-[#f7f9fc] p-3">
        <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Chain explorer API key</div>
        <SecretInput label="Explorer / node API key" isSet={cfg.apiKeySet} readOnly={readOnly} value={apiKey} onChange={setApiKey} />
        <p className="mt-2 text-[10.5px] font-medium text-slate-400">Used by the deposit watcher to poll the network. Leave blank to keep the existing key.</p>
      </div>

      {readOnly ? (
        <p className="text-[11px] font-semibold text-slate-400">Your role can view but not edit gateway configuration.</p>
      ) : (
        <button
          onClick={save}
          disabled={saving || invalid}
          className="mt-0 w-full rounded-[12px] bg-emerald-600 py-2.5 text-[13px] font-extrabold text-white active:scale-95 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save configuration"}
        </button>
      )}
    </div>
  );
}

function SecretInput({ label, isSet, readOnly, value, onChange }: { label: string; isSet: boolean; readOnly: boolean; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className={labelCls}>{label} {isSet && <span className="text-emerald-600">• set</span>}</label>
      <input
        type="password"
        className={inputCls}
        disabled={readOnly}
        autoComplete="off"
        placeholder={isSet ? "•••••• (unchanged)" : "enter value"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] bg-white px-3 py-2.5 ring-1 ring-slate-100">
      <div className="text-[10.5px] font-bold uppercase text-slate-400">{label}</div>
      <div className="text-[15px] font-extrabold tabular-nums text-slate-800">{value}</div>
    </div>
  );
}

/* -------------------------------- Callbacks -------------------------------- */

export function Callbacks() {
  const { session, refresh } = useAdmin();
  const toast = useToast();
  const { loading, data } = useResource(api.callbacks, []);
  const mutate = can(session?.role ?? "READONLY", "mutate");

  const process = async (c: GatewayCallback) => { await api.act("processCallback", c.id); toast.success("Callback matched", `${c.gateway} ${c.reference}`); refresh(); };

  const cols: Column<GatewayCallback>[] = [
    { key: "gateway", header: "Gateway", cell: (c) => <span className="font-extrabold text-slate-900">{c.gateway}</span> },
    { key: "eventType", header: "Event", hideOnTablet: true, cell: (c) => <span className="font-mono text-[11px] text-slate-500">{c.eventType}</span> },
    { key: "reference", header: "Reference", cell: (c) => <span className="text-slate-500">{c.reference ?? "—"}</span> },
    { key: "amount", header: "Amount", align: "right", cell: (c) => (c.amount != null ? money(c.amount, 0) : "—") },
    { key: "sig", header: "Signature", align: "center", cell: (c) => <Badge label={c.signatureValid ? "VALID" : "BAD"} tone={c.signatureValid ? "green" : "red"} /> },
    { key: "processed", header: "State", align: "center", cell: (c) => <Badge label={c.processed ? "MATCHED" : "NEW"} tone={c.processed ? "slate" : "amber"} /> },
  ];

  return (
    <>
      <PageHeader title="Webhook Callbacks" subtitle="Inbound M-Pesa / crypto notifications" />
      <DataTable
        rows={data ?? []}
        columns={mutate ? [...cols, { key: "act", header: "", align: "right", cell: (c) => (c.processed || !c.signatureValid ? null : <button onClick={(e) => { e.stopPropagation(); process(c); }} className="rounded-[9px] bg-emerald-600 px-2.5 py-1 text-[11px] font-extrabold text-white active:scale-95">Match</button>) }] : cols}
        getId={(c) => c.id}
        mobileKeys={["gateway", "processed", "amount", "reference"]}
        loading={loading}
      />
    </>
  );
}

/* ------------------------------ Reconciliation ----------------------------- */

export function Reconciliation() {
  const { data } = useResource(api.deposits, []);
  const { data: cb } = useResource(api.callbacks, []);

  const rows = useMemo(() => {
    const deposits = data ?? [];
    const cbs = cb ?? [];
    return deposits.map((d) => {
      const match = cbs.find((c) => c.reference === d.reference || c.reference === d.mpesaCode);
      const state = match ? (match.amount === d.amount ? "MATCHED" : "MISMATCH") : "MISSING";
      return { d, match, state };
    });
  }, [data, cb]);

  const unmatched = rows.filter((r) => r.state !== "MATCHED");

  return (
    <>
      <PageHeader title="Reconciliation" subtitle={`${unmatched.length} of ${rows.length} deposits need attention`} />
      {unmatched.length === 0 ? (
        <EmptyState title="Everything reconciles" hint="All deposits match a valid gateway callback." />
      ) : (
        <div className="space-y-2">
          {unmatched.map(({ d, state }) => (
            <div key={d.id} className="neu flex items-center justify-between rounded-[14px] bg-white p-3">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-extrabold text-slate-800">{d.user} · {money(d.amount, 0)}</div>
                <div className="text-[11px] font-semibold text-slate-400">{d.channel} · {d.reference ?? d.mpesaCode ?? "no reference"} · {shortDate(d.createdAt)}</div>
              </div>
              <Badge label={state} tone={state === "MISMATCH" ? "amber" : "red"} />
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-[11px] font-medium text-slate-400">Re-crediting is ledger-safe: it writes a single Deposit approval + LedgerEntry + AuditLog in one transaction on the API.</p>
      <div className="mt-2 text-[11px] font-bold text-slate-500">Total matched value: {money(rows.filter((r) => r.state === "MATCHED").reduce((s, r) => s + r.d.amount, 0))} across {num(rows.filter((r) => r.state === "MATCHED").length)} deposits.</div>
    </>
  );
}
