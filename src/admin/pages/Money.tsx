import { useMemo, useState } from "react";
import { api, can } from "../api";
import { useAdmin, useResource } from "../AdminStore";
import { DataTable, type Column } from "../DataTable";
import { ConfirmSheet, Drawer } from "../sheets";
import { Badge, PageHeader, SearchField, StatusPills, money, shortDate, statusTone } from "../ui";
import { useToast } from "../../components/Toast";
import type { Deposit, LedgerEntry, Withdrawal } from "../types";

/* -------------------------------- Deposits -------------------------------- */

const pendingDep = (d: Deposit) => ["PENDING", "ACTION_REQUIRED", "UNDER_REVIEW"].includes(d.status);

export function Deposits() {
  const { session, refresh } = useAdmin();
  const toast = useToast();
  const { loading, data } = useResource(api.deposits, []);
  const [tab, setTab] = useState<"queue" | "all">("queue");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Deposit | null>(null);
  const [reject, setReject] = useState<Deposit | null>(null);
  const mutate = can(session?.role ?? "READONLY", "mutate");

  const rows = useMemo(() => {
    let r = data ?? [];
    if (tab === "queue") r = r.filter(pendingDep);
    if (q) {
      const t = q.toLowerCase();
      r = r.filter((d) => d.user.toLowerCase().includes(t) || (d.mpesaCode ?? "").toLowerCase().includes(t) || (d.reference ?? "").toLowerCase().includes(t));
    }
    return r;
  }, [data, tab, q]);

  const approve = async (d: Deposit) => {
    await api.act("approveDeposit", d.id);
    toast.success("Deposit approved", `${d.user} · +${money(d.credited, 0)} credited`);
    setSel(null);
    refresh();
  };
  const doReject = async (reason: string) => {
    if (!reject) return;
    await api.act("rejectDeposit", reject.id, reason);
    toast.error("Deposit rejected", reject.user);
    setReject(null);
    refresh();
  };

  const cols: Column<Deposit>[] = [
    { key: "user", header: "User", cell: (d) => <span className="font-extrabold text-slate-900">{d.user}</span> },
    { key: "channel", header: "Channel", align: "center", hideOnTablet: true, cell: (d) => <Badge label={d.channel} tone="blue" /> },
    { key: "amount", header: "Amount", align: "right", sortable: true, cell: (d) => money(d.amount, 0) },
    { key: "credited", header: "Credited", align: "right", hideOnTablet: true, cell: (d) => <span className="text-emerald-600">{money(d.credited, 0)}{d.bonusPct > 0 ? ` (+${d.bonusPct}% bonus)` : ""}</span> },
    { key: "createdAt", header: "Received", align: "right", cell: (d) => <span className="text-slate-400">{shortDate(d.createdAt)}</span> },
    { key: "status", header: "Status", align: "center", cell: (d) => <Badge label={d.status} tone={statusTone(d.status)} /> },
  ];

  return (
    <>
      <PageHeader title="Deposits" subtitle={`${rows.length} shown`} actions={<StatusPills value={tab} onChange={setTab} options={[{ label: "To approve", value: "queue" }, { label: "All", value: "all" }]} />} />
      <div className="mb-3"><SearchField value={q} onChange={setQ} placeholder="User or reference…" /></div>
      <DataTable rows={rows} columns={cols} getId={(d) => d.id} onRowClick={setSel} mobileKeys={["user", "status", "amount", "channel"]} loading={loading} />

      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.user}'s deposit` : ""} subtitle={sel ? `${sel.channel} · ${shortDate(sel.createdAt)}` : ""}
        footer={sel && mutate && pendingDep(sel) ? (
          <div className="flex gap-2">
            <button className="mt-0 flex-1 rounded-[12px] bg-rose-50 py-2.5 text-[13px] font-extrabold text-rose-600 active:scale-95" onClick={() => { setReject(sel); setSel(null); }}>Reject</button>
            <button className="mt-0 flex-1 rounded-[12px] bg-emerald-600 py-2.5 text-[13px] font-extrabold text-white active:scale-95" onClick={() => approve(sel)}>Approve · {money(sel.credited, 0)}</button>
          </div>
        ) : undefined}>
        {sel && <Detail kvs={[["Amount", money(sel.amount)], ["Bonus", `${sel.bonusPct}%`], ["Total credit", money(sel.credited)], ["Reference", sel.reference ?? sel.mpesaCode ?? "—"], ["Status", String(sel.status)]]} />}
      </Drawer>

      <ConfirmSheet open={!!reject} onClose={() => setReject(null)} title={`Reject deposit · ${reject?.user ?? ""}`} requireReason danger confirmLabel="Reject deposit" onConfirm={doReject} />
    </>
  );
}

/* ------------------------------- Withdrawals ------------------------------- */

export function Withdrawals() {
  const { session, refresh } = useAdmin();
  const toast = useToast();
  const { loading, data } = useResource(api.withdrawals, []);
  const [tab, setTab] = useState<"queue" | "all">("queue");
  const [sel, setSel] = useState<Withdrawal | null>(null);
  const [reject, setReject] = useState<Withdrawal | null>(null);
  const mutate = can(session?.role ?? "READONLY", "mutate");
  const isFinance = session?.role === "FINANCE" || session?.role === "SUPER_ADMIN";

  const queue = ["PENDING", "UNDER_REVIEW", "APPROVED"];
  const rows = useMemo(() => (data ?? []).filter((w) => (tab === "queue" ? queue.includes(w.status) : true)), [data, tab]);

  const ops = async (w: Withdrawal) => { await api.act("opsApproveWithdrawal", w.id); toast.info("Ops approved", `${w.user} — now with finance`); setSel(null); refresh(); };
  const pay = async (w: Withdrawal) => { await api.act("payWithdrawal", w.id); toast.success("Payout paid", `${w.user} · ${money(w.amount, 0)}`); setSel(null); refresh(); };
  const doReject = async (reason: string) => { if (!reject) return; await api.act("rejectWithdrawal", reject.id, reason); toast.error("Withdrawal rejected", reject.user); setReject(null); refresh(); };

  const cols: Column<Withdrawal>[] = [
    { key: "user", header: "User", cell: (w) => <span className="font-extrabold text-slate-900">{w.user}</span> },
    { key: "channel", header: "Channel", align: "center", hideOnTablet: true, cell: (w) => <Badge label={w.channel} tone="blue" /> },
    { key: "amount", header: "Amount", align: "right", sortable: true, cell: (w) => money(w.amount, 0) },
    { key: "fee", header: "Fee", align: "right", hideOnTablet: true, cell: (w) => money(w.fee) },
    { key: "destination", header: "Destination", hideOnTablet: true, cell: (w) => <span className="text-slate-500">{w.destination}</span> },
    { key: "status", header: "Status", align: "center", cell: (w) => <Badge label={w.opsApproved && w.status !== "COMPLETED" ? `OPS ✓` : w.status} tone={statusTone(w.status)} /> },
  ];

  return (
    <>
      <PageHeader title="Withdrawals" subtitle={`${rows.length} shown`} actions={<StatusPills value={tab} onChange={setTab} options={[{ label: "To process", value: "queue" }, { label: "All", value: "all" }]} />} />
      <DataTable rows={rows} columns={cols} getId={(w) => w.id} onRowClick={setSel} mobileKeys={["user", "status", "amount", "channel"]} loading={loading} />

      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.user}'s withdrawal` : ""} subtitle={sel ? `${sel.channel} → ${sel.destination}` : ""}
        footer={sel && mutate ? (
          <div className="flex flex-wrap gap-2">
            <button className="mt-0 flex-1 rounded-[12px] bg-rose-50 py-2.5 text-[13px] font-extrabold text-rose-600 active:scale-95" onClick={() => { setReject(sel); setSel(null); }}>Reject</button>
            {!sel.opsApproved ? (
              <button className="mt-0 flex-1 rounded-[12px] bg-slate-800 py-2.5 text-[13px] font-extrabold text-white active:scale-95" onClick={() => ops(sel)}>Ops approve</button>
            ) : isFinance && sel.status !== "COMPLETED" ? (
              <button className="mt-0 flex-1 rounded-[12px] bg-emerald-600 py-2.5 text-[13px] font-extrabold text-white active:scale-95" onClick={() => pay(sel)}>Mark paid</button>
            ) : (
              <span className="mt-0 flex-1 rounded-[12px] bg-slate-100 py-2.5 text-center text-[12px] font-extrabold text-slate-500">{sel.status === "COMPLETED" ? "Paid" : "Awaiting finance"}</span>
            )}
          </div>
        ) : undefined}>
        {sel && <Detail kvs={[["Amount", money(sel.amount)], ["Fee", money(sel.fee)], ["Net", money(sel.amount - sel.fee)], ["Ops approved", sel.opsApproved ? "Yes" : "No"], ["Status", String(sel.status)]]} />}
      </Drawer>

      <ConfirmSheet open={!!reject} onClose={() => setReject(null)} title={`Reject withdrawal · ${reject?.user ?? ""}`} requireReason danger confirmLabel="Reject" onConfirm={doReject} />
    </>
  );
}

/* --------------------------------- Ledger --------------------------------- */

export function Ledger() {
  const { loading, data } = useResource(api.ledger, []);
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const r = data ?? [];
    if (!q) return r;
    const t = q.toLowerCase();
    return r.filter((l: LedgerEntry) => l.user.toLowerCase().includes(t) || (l.note ?? "").toLowerCase().includes(t));
  }, [data, q]);

  const cols: Column<LedgerEntry>[] = [
    { key: "user", header: "User", cell: (l) => <span className="font-extrabold text-slate-900">{l.user}</span> },
    { key: "type", header: "Type", align: "center", cell: (l) => <Badge label={l.type.replace("_", " ")} tone={l.amount >= 0 ? "green" : "red"} /> },
    { key: "amount", header: "Amount", align: "right", cell: (l) => <span className={l.amount >= 0 ? "text-emerald-600" : "text-rose-500"}>{l.amount >= 0 ? "+" : ""}{money(l.amount)}</span> },
    { key: "balanceAfter", header: "Balance after", align: "right", hideOnTablet: true, cell: (l) => money(l.balanceAfter) },
    { key: "note", header: "Note", hideOnTablet: true, cell: (l) => <span className="text-slate-500">{l.note ?? "—"}</span> },
    { key: "createdAt", header: "When", align: "right", cell: (l) => <span className="text-slate-400">{shortDate(l.createdAt)}</span> },
  ];

  return (
    <>
      <PageHeader title="Ledger" subtitle="Immutable money trail" />
      <div className="mb-3"><SearchField value={q} onChange={setQ} placeholder="User or note…" /></div>
      <DataTable rows={rows} columns={cols} getId={(l) => l.id} mobileKeys={["user", "amount", "type", "createdAt"]} loading={loading} />
    </>
  );
}

/* --------------------------------- shared --------------------------------- */

function Detail({ kvs }: { kvs: [string, string][] }) {
  return (
    <dl className="space-y-1.5">
      {kvs.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between border-b border-slate-100 py-2 text-[13px]">
          <dt className="font-semibold text-slate-400">{k}</dt>
          <dd className="max-w-[60%] truncate text-right font-extrabold text-slate-800">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
