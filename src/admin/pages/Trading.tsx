import { useMemo, useState } from "react";
import { api, can } from "../api";
import { useAdmin, useResource } from "../AdminStore";
import { DataTable, type Column } from "../DataTable";
import { Drawer } from "../sheets";
import { Badge, PageHeader, StatusPills, money, num, shortDate, statusTone } from "../ui";
import { useToast } from "../../components/Toast";
import type { BotConfig, Market, Position, Run } from "../types";

/* -------------------------------- Positions -------------------------------- */

export function Positions() {
  const { session, refresh } = useAdmin();
  const toast = useToast();
  const { loading, data } = useResource(api.positions, []);
  const [tab, setTab] = useState<"open" | "all">("open");
  const [origin, setOrigin] = useState<"all" | "auto" | "manual">("all");
  const [sel, setSel] = useState<Position | null>(null);
  const mutate = can(session?.role ?? "READONLY", "mutate");
  const openSt = ["OPEN"];

  const rows = useMemo(
    () =>
      (data ?? [])
        .filter((p) => (tab === "open" ? openSt.includes(p.status) : true))
        .filter((p) => (origin === "all" ? true : origin === "auto" ? !!p.bot : !p.bot)),
    [data, tab, origin],
  );

  const settle = async (p: Position, won: boolean) => {
    await api.act("settlePosition", p.id, won);
    if (won) toast.success("Position settled · WON", `${p.user} +${money(Math.round(p.amount * 0.87), 0)}`);
    else toast.error("Position settled · LOST", `${p.user} -${money(p.amount, 0)}`);
    setSel(null);
    refresh();
  };

  const cols: Column<Position>[] = [
    { key: "user", header: "User", cell: (p) => <span className="font-extrabold text-slate-900">{p.user}</span> },
    { key: "origin", header: "Source", align: "center", cell: (p) => <Badge label={p.bot ? "Auto" : "Manual"} tone={p.bot ? "violet" : "slate"} /> },
    { key: "side", header: "Side", align: "center", cell: (p) => <span className={p.side === "BUY" ? "font-extrabold text-emerald-600" : "font-extrabold text-rose-500"}>{p.side}</span> },
    { key: "market", header: "Market", cell: (p) => <span className="text-slate-600">{p.market}</span> },
    { key: "amount", header: "Stake", align: "right", sortable: true, cell: (p) => money(p.amount, 0) },
    { key: "payout", header: "Payout", align: "right", hideOnTablet: true, cell: (p) => (p.payout != null ? <span className="text-emerald-600">{money(p.payout, 0)}</span> : <span className="text-slate-300">—</span>) },
    { key: "status", header: "Status", align: "center", cell: (p) => <Badge label={p.status} tone={statusTone(p.status)} /> },
  ];

  return (
    <>
      <PageHeader
        title="Positions"
        subtitle={`${rows.length} shown`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPills value={origin} onChange={setOrigin} options={[{ label: "All", value: "all" }, { label: "Auto", value: "auto" }, { label: "Manual", value: "manual" }]} />
            <StatusPills value={tab} onChange={setTab} options={[{ label: "Open", value: "open" }, { label: "All", value: "all" }]} />
          </div>
        }
      />
      <DataTable rows={rows} columns={cols} getId={(p) => p.id} onRowClick={setSel} mobileKeys={["user", "origin", "status", "side", "amount"]} loading={loading} />
      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.side} ${sel.market}` : ""} subtitle={sel ? `${sel.user} · ${sel.bot ? "Auto (bot)" : "Manual"} · ${shortDate(sel.openedAt)}` : ""}
        footer={sel && mutate && sel.status === "OPEN" ? (
          <div className="flex gap-2">
            <button className="mt-0 flex-1 rounded-[12px] bg-rose-600 py-2.5 text-[13px] font-extrabold text-white active:scale-95" onClick={() => settle(sel, false)}>Settle LOST</button>
            <button className="mt-0 flex-1 rounded-[12px] bg-emerald-600 py-2.5 text-[13px] font-extrabold text-white active:scale-95" onClick={() => settle(sel, true)}>Settle WON</button>
          </div>
        ) : undefined}>
        {sel && (
          <div className="space-y-1.5 text-[13px]">
            <KV k="Entry" v={String(sel.entryPrice)} />
            <KV k="Close" v={sel.closePrice != null ? String(sel.closePrice) : "—"} />
            <KV k="Stake" v={money(sel.amount)} />
            <KV k="Duration" v={`${sel.duration}s`} />
            <KV k="Expiry" v={shortDate(sel.expiresAt)} />
            <KV k="Status" v={String(sel.status)} />
          </div>
        )}
      </Drawer>
    </>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2">
      <span className="font-semibold text-slate-400">{k}</span>
      <span className="font-extrabold text-slate-800">{v}</span>
    </div>
  );
}

/* ---------------------------------- Runs ---------------------------------- */

export function Runs() {
  const { loading, data } = useResource(api.runs, []);
  const cols: Column<Run>[] = [
    { key: "user", header: "User", cell: (r) => <span className="font-extrabold text-slate-900">{r.user}</span> },
    { key: "side", header: "Side", align: "center", cell: (r) => <span className={r.side === "BUY" ? "text-emerald-600 font-extrabold" : "text-rose-500 font-extrabold"}>{r.side}</span> },
    { key: "market", header: "Market", cell: (r) => r.market },
    { key: "total", header: "Trades", align: "right", hideOnTablet: true, cell: (r) => `${r.total - r.remaining} / ${r.total}` },
    {
      key: "progress",
      header: "Progress",
      cell: (r) => {
        const done = r.total - r.remaining;
        return (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-[linear-gradient(90deg,#10b981,#047857)]" style={{ width: `${(done / r.total) * 100}%` }} />
            </div>
            <span className="text-[10.5px] font-bold text-slate-400">{r.remaining > 0 ? `${r.remaining} left` : "done"}</span>
          </div>
        );
      },
    },
    { key: "status", header: "Status", align: "center", cell: (r) => <Badge label={r.status} tone={statusTone(r.status)} /> },
  ];
  return (
    <>
      <PageHeader title="Runs" subtitle="Sequential multi-trade queues (one after another)" />
      <DataTable rows={data ?? []} columns={cols} getId={(r) => r.id} mobileKeys={["user", "status", "market", "total"]} loading={loading} />
    </>
  );
}

/* ---------------------------------- Bots ---------------------------------- */

const botTone = (s: string) => (s === "RUNNING" ? "violet" : s === "DONE" ? "green" : s === "STOPPED" ? "red" : "slate");

export function Bots() {
  const { session, refresh } = useAdmin();
  const toast = useToast();
  const { loading, data } = useResource(api.bots, []);
  const [tab, setTab] = useState<"all" | "running" | "stopped">("all");
  const [sel, setSel] = useState<BotConfig | null>(null);
  const mutate = can(session?.role ?? "READONLY", "mutate");

  const rows = useMemo(
    () =>
      (data ?? [])
        .filter((b) =>
          tab === "all" ? true : tab === "running" ? b.status === "RUNNING" : b.status === "STOPPED" || b.status === "DONE",
        )
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [data, tab],
  );

  const kill = async (b: BotConfig) => {
    await api.act("killBot", b.id);
    toast.info("Bot killed", `${b.market} bot by ${b.userId} stopped.`);
    setSel(null);
    refresh();
  };

  const cols: Column<BotConfig>[] = [
    { key: "user", header: "Trader", cell: (b) => <span className="font-extrabold text-slate-900">{b.userId}</span> },
    { key: "market", header: "Market", cell: (b) => <span className="text-slate-600">{b.market}</span> },
    { key: "stake", header: "Stake", align: "right", cell: (b) => money(b.stake, 0) },
    { key: "config", header: "Batch", align: "center", hideOnTablet: true, cell: (b) => <span className="text-[11.5px] font-bold text-slate-500">{b.duration}s × {b.total}{b.repeat ? " ↻" : ""}</span> },
    { key: "done", header: "Progress", align: "right", cell: (b) => <span className="tabular-nums font-extrabold text-slate-700">{b.done}/{b.total}</span> },
    { key: "realized", header: "Realized", align: "right", sortable: true, cell: (b) => <span className={b.realized >= 0 ? "font-extrabold text-emerald-600" : "font-extrabold text-rose-500"}>{b.realized >= 0 ? "+" : "-"}{money(Math.abs(b.realized), 0)}</span> },
    { key: "status", header: "Status", align: "center", cell: (b) => <Badge label={b.status} tone={botTone(b.status)} /> },
  ];

  return (
    <>
      <PageHeader
        title="Trading Bots"
        subtitle="Auto-trade configs — kill any bot that misbehaves"
        actions={<StatusPills value={tab} onChange={setTab} options={[{ label: "All", value: "all" }, { label: "Running", value: "running" }, { label: "Stopped", value: "stopped" }]} />}
      />
      <DataTable rows={rows} columns={cols} getId={(b) => b.id} onRowClick={setSel} mobileKeys={["user", "market", "status", "realized"]} loading={loading} />
      <Drawer
        open={!!sel}
        onClose={() => setSel(null)}
        title={sel ? `${sel.market} bot` : ""}
        subtitle={sel ? `${sel.userId} · ${sel.direction}` : ""}
        footer={sel && mutate && sel.status === "RUNNING" ? (
          <button className="mt-0 flex-1 rounded-[12px] bg-rose-600 py-2.5 text-[13px] font-extrabold text-white active:scale-95" onClick={() => kill(sel)}>Kill bot</button>
        ) : undefined}
      >
        {sel && (
          <div className="space-y-1.5 text-[13px]">
            <KV k="Status" v={sel.status} />
            <KV k="Stake" v={`${money(sel.stake, 0)} (min ${num(50)})`} />
            <KV k="Duration" v={`${sel.duration}s`} />
            <KV k="Runs / batch" v={`${sel.done} / ${sel.total}`} />
            <KV k="Repeat" v={sel.repeat ? "Yes" : "No"} />
            <KV k="Take profit" v={sel.takeProfit > 0 ? `+${money(sel.takeProfit, 0)}` : "off"} />
            <KV k="Stop loss" v={sel.stopLoss > 0 ? `-${money(sel.stopLoss, 0)}` : "off"} />
            <KV k="Early close" v={sel.earlyClose ? "On" : "Off"} />
            <KV k="Realized P&L" v={`${sel.realized >= 0 ? "+" : "-"}${money(Math.abs(sel.realized), 0)}`} />
            <KV k="Created" v={shortDate(sel.createdAt)} />
          </div>
        )}
      </Drawer>
    </>
  );
}

/* --------------------------------- Markets -------------------------------- */

export function Markets() {
  const { session, refresh } = useAdmin();
  const toast = useToast();
  const { loading, data } = useResource(api.markets, []);
  const [sel, setSel] = useState<Market | null>(null);
  const mutate = can(session?.role ?? "READONLY", "mutate");

  const toggle = async (m: Market) => { await api.act("toggleMarket", m.code); toast.info(m.active ? "Market disabled" : "Market enabled", m.name); refresh(); };
  const setPayout = async (m: Market, pct: number) => { await api.act("setMarketPayout", m.code, pct); toast.success("Payout updated", `${m.name} → ${pct}%`); refresh(); };

  const cols: Column<Market>[] = [
    { key: "name", header: "Market", cell: (m) => <span className="font-extrabold text-slate-900">{m.name}</span> },
    { key: "category", header: "Class", align: "center", hideOnTablet: true, cell: (m) => <Badge label={m.category} tone="violet" /> },
    { key: "basePrice", header: "Base", align: "right", hideOnTablet: true, cell: (m) => m.basePrice.toLocaleString("en-US") },
    { key: "payoutPct", header: "Payout", align: "center", cell: (m) => <span className="font-extrabold text-emerald-600">{m.payoutPct}%</span> },
    { key: "active", header: "Live", align: "center", cell: (m) => <Badge label={m.active ? "ON" : "OFF"} tone={m.active ? "green" : "slate"} /> },
  ];

  return (
    <>
      <PageHeader title="Markets & Payouts" subtitle="Instruments and per-market win payout" />
      <DataTable rows={data ?? []} columns={cols} getId={(m) => m.code} onRowClick={setSel} mobileKeys={["name", "active", "payoutPct", "category"]} loading={loading} />
      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.name ?? ""} subtitle={sel ? `${sel.category} · ${sel.digits} decimals` : ""}
        footer={sel && mutate ? (
          <div className="flex gap-2">
            <button className="mt-0 flex-1 rounded-[12px] bg-slate-800 py-2.5 text-[13px] font-extrabold text-white active:scale-95" onClick={() => toggle(sel)}>{sel.active ? "Disable" : "Enable"}</button>
            <button className="mt-0 flex-1 rounded-[12px] bg-emerald-600 py-2.5 text-[13px] font-extrabold text-white active:scale-95" onClick={() => setPayout(sel, Math.min(95, sel.payoutPct + 1))}>Payout +1%</button>
          </div>
        ) : undefined}>
        {sel && (
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-[12px] bg-[#e7f8ef] px-3 py-2.5">
              <span className="text-[12px] font-bold text-emerald-700">Win payout</span>
              <input value={sel.payoutPct} disabled={!mutate} onChange={(e) => setPayout(sel, Math.max(50, Math.min(95, Number(e.target.value) || 0)))} inputMode="numeric" className="w-16 rounded-[8px] bg-white px-2 py-1 text-right text-[14px] font-extrabold text-emerald-700 outline-none" />
            </div>
            <p className="text-[11px] font-medium text-slate-400">Changing the payout only affects trades opened after the update. Toggle a market off to hide it from the trader app.</p>
          </div>
        )}
      </Drawer>
    </>
  );
}
