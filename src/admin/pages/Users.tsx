import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api, can } from "../api";
import { useAdmin, useResource } from "../AdminStore";
import { DataTable, type Column } from "../DataTable";
import { ConfirmSheet, Drawer, Field, inputCls } from "../sheets";
import { Badge, EmptyState, PageHeader, SearchField, StatusPills, money, shortDate, statusTone } from "../ui";
import { useToast } from "../../components/Toast";
import type { KycApplication, User } from "../types";

/* --------------------------------- Users --------------------------------- */

export function Users() {
  const { session, refresh } = useAdmin();
  const toast = useToast();
  const { loading, data } = useResource(api.users, []);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"ALL" | User["status"]>("ALL");
  const [sel, setSel] = useState<User | null>(null);
  const [adjust, setAdjust] = useState<{ user: User; open: boolean } | null>(null);
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const [winRateInput, setWinRateInput] = useState("");
  const [email, setEmail] = useState<{ user: User; open: boolean } | null>(null);
  const [emailMode, setEmailMode] = useState<"template" | "custom">("template");
  const [emailTemplateKey, setEmailTemplateKey] = useState("WELCOME");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const { data: templates } = useResource(api.emailTemplates, []);

  useEffect(() => {
    setWinRateInput(sel && typeof sel.winRate === "number" ? String(sel.winRate) : "");
  }, [sel]);

  const rows = useMemo(() => {
    let r = data ?? [];
    if (status !== "ALL") r = r.filter((u) => u.status === status);
    if (q) {
      const t = q.toLowerCase();
      r = r.filter((u) => u.fullName.toLowerCase().includes(t) || u.phone.includes(t) || u.referralCode.toLowerCase().includes(t));
    }
    return r;
  }, [data, q, status]);

  const cols: Column<User>[] = [
    { key: "fullName", header: "User", sortable: true, cell: (u) => <div className="font-extrabold text-slate-900">{u.fullName}</div> },
    { key: "phone", header: "Phone", hideOnTablet: true, cell: (u) => <span className="text-slate-500">{u.phone}</span> },
    { key: "realBalance", header: "Real", align: "right", sortable: true, cell: (u) => money(u.realBalance) },
    { key: "kyc", header: "KYC", align: "center", cell: (u) => <Badge label={u.kyc} tone={statusTone(u.kyc)} /> },
    { key: "status", header: "Status", align: "center", cell: (u) => <Badge label={u.status} tone={statusTone(u.status)} /> },
    { key: "lastLoginAt", header: "Last login", align: "right", hideOnTablet: true, cell: (u) => <span className="text-slate-400">{u.lastLoginAt ? shortDate(u.lastLoginAt) : "—"}</span> },
  ];

  const mutate = can(session?.role ?? "READONLY", "mutate");

  const doAdjust = async () => {
    const d = Number(delta) || 0;
    if (!d || !adjust) return;
    await api.act("adjustBalance", adjust.user.id, d, note || "manual adjustment");
    toast.success("Balance adjusted", `${d > 0 ? "+" : ""}${money(d)} · ${adjust.user.fullName}`);
    setAdjust(null);
    setDelta("");
    setNote("");
    refresh();
  };

  const setSt = async (u: User, s: User["status"]) => {
    await api.act("setUserStatus", u.id, s);
    toast.info("User updated", `${u.fullName} → ${s}`);
    refresh();
  };

  const toggleAutoPayout = async (u: User) => {
    const next = !u.autoPayout;
    await api.act("setUserAutoPayout", u.id, next);
    toast.success(
      next ? "Auto payout enabled" : "Auto payout disabled",
      next ? `${u.fullName} · withdrawals now settle instantly.` : `${u.fullName} · withdrawals return to the review queue.`,
    );
    setSel({ ...u, autoPayout: next });
    refresh();
  };

  const isSuper = session?.role === "SUPER_ADMIN";

  const saveWinRateValue = async (val: number | null) => {
    if (!sel) return;
    await api.act("setUserWinRate", sel.id, val);
    toast.success(val === null ? "Win rate cleared" : "Win rate set", `${sel.fullName} · ${val === null ? "real outcomes" : `${val}%`}`);
    setSel({ ...sel, winRate: val === null ? undefined : val });
    setWinRateInput(val === null ? "" : String(val));
    refresh();
  };
  const saveWinRate = () => {
    const raw = winRateInput.trim();
    if (raw === "") return void saveWinRateValue(null);
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    void saveWinRateValue(Math.max(0, Math.min(100, Math.round(n * 100) / 100)));
  };

  const sendEmail = async () => {
    if (!email) return;
    if (!email.user.email) return void toast.error("No email on file", email.user.fullName);
    const payload: { template?: string; subject?: string; body?: string } =
      emailMode === "template"
        ? { template: emailTemplateKey }
        : { subject: emailSubject.trim(), body: emailBody.trim() };
    if (emailMode === "custom" && (!payload.subject || !payload.body)) return void toast.error("Subject and body required");
    try {
      await api.sendUserEmail(email.user.id, payload);
      toast.success("Email sent", `${email.user.fullName} · ${email.user.email}`);
      setEmail(null);
      setEmailSubject("");
      setEmailBody("");
    } catch (e) {
      toast.error("Send failed", (e as Error).message);
    }
  };

  return (
    <>
      <PageHeader title="Users" subtitle={`${rows.length} of ${(data ?? []).length}`} />
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchField value={q} onChange={setQ} placeholder="Name, phone or referral code…" />
        <StatusPills
          value={status}
          onChange={setStatus}
          options={[
            { label: "All", value: "ALL" },
            { label: "Active", value: "ACTIVE" },
            { label: "Suspended", value: "SUSPENDED" },
            { label: "Banned", value: "BANNED" },
          ]}
        />
      </div>

      <DataTable rows={rows} columns={cols} getId={(u) => u.id} onRowClick={setSel} mobileKeys={["fullName", "status", "realBalance", "kyc"]} loading={loading} />

      {/* detail drawer */}
      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.fullName ?? ""} subtitle={sel ? `${sel.phone} · ${sel.referralCode}` : ""}>
        {sel && (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div className="rounded-[12px] bg-[#e7f8ef] p-3">
                <div className="text-[10.5px] font-bold uppercase text-emerald-600">Real balance</div>
                <div className="text-[18px] font-extrabold tabular-nums text-emerald-800">{money(sel.realBalance)}</div>
              </div>
              <div className="rounded-[12px] bg-slate-100 p-3">
                <div className="text-[10.5px] font-bold uppercase text-slate-500">Demo balance</div>
                <div className="text-[18px] font-extrabold tabular-nums text-slate-700">{money(sel.demoBalance)}</div>
              </div>
            </div>
            <dl className="mb-2 space-y-1.5 text-[12.5px]">
              <Row k="Status" v={<Badge label={sel.status} tone={statusTone(sel.status)} />} />
              <Row
                k="Auto payout"
                v={
                  sel.autoPayout ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-extrabold text-emerald-700">ON</span>
                  ) : (
                    <span className="font-semibold text-slate-400">Off</span>
                  )
                }
              />
              <Row k="KYC" v={<Badge label={sel.kyc} tone={statusTone(sel.kyc)} />} />
              <Row k="Email" v={sel.email ?? "—"} />
              <Row k="Country" v={sel.countryCode} />
              {typeof sel.winRate === "number" && <Row k="Win rate" v={`${sel.winRate}%`} />}
              <Row k="Joined" v={shortDate(sel.createdAt)} />
              {sel.referredBy && <Row k="Referred by" v={sel.referredBy} />}
            </dl>
            {mutate && (
              <div className="flex flex-wrap gap-2">
                <button className="neu-sm rounded-[10px] bg-white px-3 py-1.5 text-[12px] font-extrabold text-emerald-700 active:scale-95" onClick={() => setAdjust({ user: sel, open: true })}>
                  Adjust balance
                </button>
                <button className="neu-sm rounded-[10px] bg-white px-3 py-1.5 text-[12px] font-extrabold text-sky-700 active:scale-95" onClick={() => setEmail({ user: sel, open: true })}>
                  Send email
                </button>
                <button
                  className="neu-sm rounded-[10px] bg-white px-3 py-1.5 text-[12px] font-extrabold text-violet-700 active:scale-95"
                  onClick={() => toggleAutoPayout(sel)}
                >
                  {sel.autoPayout ? "Disable auto payout" : "Enable auto payout"}
                </button>
                {sel.status === "ACTIVE" && (
                  <button className="neu-sm rounded-[10px] bg-white px-3 py-1.5 text-[12px] font-extrabold text-amber-600 active:scale-95" onClick={() => setSt(sel, "SUSPENDED")}>
                    Suspend
                  </button>
                )}
                {sel.status === "SUSPENDED" && (
                  <button className="neu-sm rounded-[10px] bg-white px-3 py-1.5 text-[12px] font-extrabold text-emerald-700 active:scale-95" onClick={() => setSt(sel, "ACTIVE")}>
                    Reactivate
                  </button>
                )}
                {sel.status !== "BANNED" && (
                  <button className="neu-sm rounded-[10px] bg-white px-3 py-1.5 text-[12px] font-extrabold text-rose-600 active:scale-95" onClick={() => setSt(sel, "BANNED")}>
                    Ban
                  </button>
                )}
              </div>
            )}
            {isSuper && (
              <div className="mt-4 rounded-[12px] bg-slate-100 p-3">
                <div className="text-[10.5px] font-bold uppercase text-slate-500">Trade win rate</div>
                <p className="mt-0.5 text-[11.5px] font-medium text-slate-400">Force this user's trades to win at this %. Leave blank to settle on real price.</p>
                <div className="mt-2 flex gap-2">
                  <input
                    value={winRateInput}
                    onChange={(e) => setWinRateInput(e.target.value.replace(/[^0-9.]/g, ""))}
                    inputMode="decimal"
                    placeholder="e.g. 75"
                    className="min-w-0 flex-1 rounded-[12px] bg-white px-3 py-2.5 text-[14px] font-bold text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-300 placeholder:font-medium placeholder:text-slate-400"
                  />
                  <button className="neu-sm rounded-[10px] bg-white px-3 py-1.5 text-[12px] font-extrabold text-emerald-700 active:scale-95" onClick={saveWinRate}>
                    Save
                  </button>
                  {typeof sel.winRate === "number" && (
                    <button className="neu-sm rounded-[10px] bg-white px-3 py-1.5 text-[12px] font-extrabold text-slate-600 active:scale-95" onClick={() => saveWinRateValue(null)}>
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </Drawer>

      <Drawer
        open={!!adjust?.open}
        onClose={() => setAdjust(null)}
        title={adjust ? `Adjust ${adjust.user.fullName}` : ""}
        subtitle="Positive credits, negative debits. Recorded to ledger + audit."
        footer={
          <div className="flex gap-2">
            <button className="mt-0 flex-1 rounded-[12px] bg-slate-100 py-2.5 text-[13px] font-extrabold text-slate-600 active:scale-95" onClick={() => setAdjust(null)}>
              Cancel
            </button>
            <button className="mt-0 flex-1 rounded-[12px] bg-emerald-600 py-2.5 text-[13px] font-extrabold text-white active:scale-95" onClick={doAdjust}>
              Apply
            </button>
          </div>
        }
      >
        <Field label="Amount (USD)">
          <input value={delta} onChange={(e) => setDelta(e.target.value.replace(/[^0-9.-]/g, ""))} inputMode="decimal" className={inputCls} placeholder="e.g. 250 or -100" />
        </Field>
        <Field label="Note">
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder="Reason for adjustment" />
        </Field>
      </Drawer>

      <Drawer
        open={!!email?.open}
        onClose={() => setEmail(null)}
        title={email ? `Email ${email.user.fullName}` : ""}
        subtitle={email?.user.email ? `Sends to ${email.user.email}` : "No email address on file"}
        footer={
          <div className="flex gap-2">
            <button className="mt-0 flex-1 rounded-[12px] bg-slate-100 py-2.5 text-[13px] font-extrabold text-slate-600 active:scale-95" onClick={() => setEmail(null)}>
              Cancel
            </button>
            <button
              className="mt-0 flex-1 rounded-[12px] bg-emerald-600 py-2.5 text-[13px] font-extrabold text-white active:scale-95 disabled:opacity-40"
              disabled={!email?.user.email}
              onClick={sendEmail}
            >
              Send email
            </button>
          </div>
        }
      >
        <div className="mb-3 flex gap-2">
          <button
            className={`flex-1 rounded-[10px] px-3 py-2 text-[12px] font-extrabold active:scale-95 ${emailMode === "template" ? "bg-emerald-600 text-white" : "neu-sm bg-white text-slate-600"}`}
            onClick={() => setEmailMode("template")}
          >
            Template
          </button>
          <button
            className={`flex-1 rounded-[10px] px-3 py-2 text-[12px] font-extrabold active:scale-95 ${emailMode === "custom" ? "bg-emerald-600 text-white" : "neu-sm bg-white text-slate-600"}`}
            onClick={() => setEmailMode("custom")}
          >
            Custom
          </button>
        </div>
        {emailMode === "template" ? (
          <Field label="Template">
            <select value={emailTemplateKey} onChange={(e) => setEmailTemplateKey(e.target.value)} className={inputCls}>
              {(templates ?? []).map((t) => (
                <option key={t.key} value={t.key}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <>
            <Field label="Subject">
              <input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} className={inputCls} placeholder="Email subject" />
            </Field>
            <Field label="Message">
              <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={8} className={inputCls + " resize-none"} placeholder="Write your message. Use {{name}} to personalise." />
            </Field>
          </>
        )}
      </Drawer>
    </>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-1.5">
      <dt className="font-semibold text-slate-400">{k}</dt>
      <dd className="font-extrabold text-slate-700">{v}</dd>
    </div>
  );
}

/* ---------------------------------- KYC ---------------------------------- */

export function KycQueue() {
  const { session, refresh } = useAdmin();
  const toast = useToast();
  const { loading, data } = useResource(api.kyc, []);
  const [reject, setReject] = useState<KycApplication | null>(null);
  const mutate = can(session?.role ?? "READONLY", "mutate");

  const rows = (data ?? []).filter((k) => k.status === "UNDER_REVIEW" || k.status === "PENDING");

  const approve = async (k: KycApplication) => {
    await api.act("approveKyc", k.id);
    toast.success("KYC approved", k.user);
    refresh();
  };
  const doReject = async (reason: string) => {
    if (!reject) return;
    await api.act("rejectKyc", reject.id, reason);
    toast.error("KYC rejected", reject.user);
    setReject(null);
    refresh();
  };

  const cols: Column<KycApplication>[] = [
    { key: "user", header: "Applicant", cell: (k) => <span className="font-extrabold text-slate-900">{k.user}</span> },
    { key: "docType", header: "Document", hideOnTablet: true },
    { key: "country", header: "Country", align: "center", hideOnTablet: true },
    { key: "submittedAt", header: "Submitted", align: "right", cell: (k) => shortDate(k.submittedAt) },
    { key: "status", header: "Status", align: "center", cell: (k) => <Badge label={k.status} tone={statusTone(k.status)} /> },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (k) =>
        mutate ? (
          <div className="flex justify-end gap-1.5">
            <button onClick={(e) => { e.stopPropagation(); approve(k); }} className="rounded-[9px] bg-emerald-600 px-2.5 py-1 text-[11px] font-extrabold text-white active:scale-95">Approve</button>
            <button onClick={(e) => { e.stopPropagation(); setReject(k); }} className="rounded-[9px] bg-rose-50 px-2.5 py-1 text-[11px] font-extrabold text-rose-600 active:scale-95">Reject</button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <PageHeader title="KYC Queue" subtitle={`${rows.length} awaiting review`} />
      {rows.length === 0 && !loading ? <EmptyState title="KYC queue is clear" hint="No applications awaiting review." /> : (
        <DataTable rows={rows} columns={cols} getId={(k) => k.id} mobileKeys={["user", "status", "country", "submittedAt"]} loading={loading} />
      )}
      <ConfirmSheet open={!!reject} onClose={() => setReject(null)} title={`Reject ${reject?.user ?? ""}`} requireReason danger confirmLabel="Reject" onConfirm={doReject} />
    </>
  );
}
