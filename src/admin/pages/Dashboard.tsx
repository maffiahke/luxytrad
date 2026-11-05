import { api } from "../api";
import { useAdmin, useResource } from "../AdminStore";
import { Badge, Loading, PageHeader, StatCard, money, num, shortDate, statusTone } from "../ui";
import { BriefcaseIcon, DownloadIcon, Robot, ShieldIcon, TargetIcon, UserIcon } from "../../components/icons";
import type { RouteId } from "../layout";

/** dependency-free responsive volume chart */
function VolumeChart({ series }: { series: { label: string; deposits: number; withdrawals: number }[] }) {
  const w = 100;
  const h = 46;
  const max = Math.max(...series.flatMap((s) => [s.deposits, s.withdrawals]), 1);
  const step = w / series.length;
  const bar = (vals: number[], color: string, off: number) =>
    vals.map((v, i) => {
      const bh = (v / max) * (h - 6);
      return <rect key={i} x={i * step + off} y={h - bh} width={step * 0.34} height={bh} rx={0.8} fill={color} />;
    });
  return (
    <div className="neu rounded-[18px] bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[13px] font-extrabold text-slate-800">Weekly flow · deposits vs withdrawals</h3>
        <div className="flex items-center gap-3 text-[10.5px] font-bold text-slate-500">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Deposits</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" />Withdrawals</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-40 w-full" role="img" aria-label="Deposits vs withdrawals bar chart">
        {bar(series.map((s) => s.deposits), "#10b981", step * 0.12)}
        {bar(series.map((s) => s.withdrawals), "#fb7185", step * 0.5)}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] font-bold uppercase text-slate-400">
        {series.map((s) => (
          <span key={s.label} style={{ width: `${step}%` }}>{s.label}</span>
        ))}
      </div>
    </div>
  );
}

export function Dashboard({ onGo }: { onGo: (r: RouteId) => void }) {
  const { loading, data } = useResource(api.kpis, []);
  const { data: depData } = useResource(api.deposits, []);
  const { data: usersData } = useResource(api.users, []);
  const { data: botsData } = useResource(api.bots, []);
  const { session } = useAdmin();
  if (loading || !data) return <Loading />;

  const pending = (depData ?? []).filter((d) => ["PENDING", "ACTION_REQUIRED", "UNDER_REVIEW"].includes(d.status)).slice(0, 5);
  const newest = (usersData ?? []).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 5);
  const runningBots = (botsData ?? []).filter((b) => b.status === "RUNNING");
  const botTone = (s: string) => (s === "RUNNING" ? "violet" : s === "DONE" ? "green" : s === "STOPPED" ? "red" : "slate");

  return (
    <>
      <PageHeader title={`Good day, ${session?.name.split(" ")[0] ?? "Admin"}`} subtitle="Platform health at a glance" />

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Active users" value={num(data.activeUsers)} sub={`${data.verifiedPct}% KYC verified`} icon={<UserIcon className="h-4 w-4" />} tone="green" />
        <StatCard label="Pending deposits" value={num(data.pendingDepositCount)} sub={money(data.pendingDepositValue, 0) + " awaiting approval"} icon={<DownloadIcon className="h-4 w-4" />} tone="amber" />
        <StatCard label="Pending withdrawals" value={num(data.pendingWithdrawalCount)} sub={money(data.pendingWithdrawalValue, 0) + " queued"} icon={<ShieldIcon className="h-4 w-4" />} tone="amber" />
        <StatCard label="Open positions" value={num(data.openPositions)} sub="live trades" icon={<TargetIcon className="h-4 w-4" />} tone="blue" />
        <StatCard label="Net P&L today" value={money(data.netPnlToday)} sub="house position" tone={data.netPnlToday >= 0 ? "green" : "red"} icon={<BriefcaseIcon className="h-4 w-4" />} />
        <StatCard label="Bot volume" value={money(data.botVolume, 0)} sub={`${runningBots.length} bot${runningBots.length === 1 ? "" : "s"} running`} tone="violet" icon={<Robot className="h-4 w-4" />} />
        <StatCard label="Open tickets" value={num(data.openTickets)} sub="support backlog" icon={<BriefcaseIcon className="h-4 w-4" />} tone="violet" />
      </div>

      <div className="neu mt-3 rounded-[18px] bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-[13px] font-extrabold text-slate-800">
            <Robot className="h-4 w-4 text-violet-600" /> Live trading bots
          </h3>
          <button onClick={() => onGo("bots")} className="text-[11px] font-extrabold text-emerald-600">Manage</button>
        </div>
        <div className="space-y-1.5">
          {runningBots.map((b) => (
            <div key={b.id} className="flex items-center justify-between rounded-[10px] bg-[#f7f9fc] px-2.5 py-1.5">
              <div className="min-w-0">
                <div className="truncate text-[12px] font-extrabold text-slate-800">{b.market} <span className="font-semibold text-slate-400">· {b.userId}</span></div>
                <div className="text-[10.5px] font-semibold text-slate-400">${b.stake} × {b.duration}s · trade {b.done}/{b.total}{b.repeat ? " · repeats" : ""}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[12px] font-extrabold tabular-nums ${b.realized >= 0 ? "text-emerald-600" : "text-rose-500"}`}>
                  {b.realized >= 0 ? "+" : "-"}{money(Math.abs(b.realized), 0)}
                </span>
                <Badge label={b.status} tone={botTone(b.status)} />
              </div>
            </div>
          ))}
          {runningBots.length === 0 && <div className="py-4 text-center text-[12px] font-bold text-slate-400">No bots running right now</div>}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <VolumeChart series={data.volumeSeries} />
        </div>
        <div className="neu rounded-[18px] bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[13px] font-extrabold text-slate-800">Quick queue</h3>
            <button onClick={() => onGo("deposits")} className="text-[11px] font-extrabold text-emerald-600">View all</button>
          </div>
          <div className="space-y-1.5">
            {pending.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-[10px] bg-[#f7f9fc] px-2.5 py-1.5">
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-extrabold text-slate-800">{d.user}</div>
                  <div className="text-[10.5px] font-semibold text-slate-400">{d.channel} · {shortDate(d.createdAt)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-extrabold tabular-nums text-slate-700">{money(d.amount, 0)}</span>
                  <Badge label={d.status} tone={statusTone(d.status)} />
                </div>
              </div>
            ))}
            {pending.length === 0 && <div className="py-6 text-center text-[12px] font-bold text-slate-400">Nothing to approve 🎉</div>}
          </div>
        </div>
      </div>

      <div className="neu mt-3 rounded-[18px] bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[13px] font-extrabold text-slate-800">Newest sign-ups</h3>
          <button onClick={() => onGo("users")} className="text-[11px] font-extrabold text-emerald-600">All users</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {newest.map((u) => (
            <div key={u.id} className="flex items-center gap-2 rounded-[12px] bg-[#f7f9fc] px-2.5 py-1.5">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-emerald-50 text-[12px] font-extrabold text-emerald-700">
                {u.fullName.split(" ").map((n) => n[0]).slice(0, 2).join("")}
              </div>
              <div className="leading-tight">
                <div className="text-[12px] font-extrabold text-slate-800">{u.fullName}</div>
                <div className="text-[10px] font-semibold text-slate-400">{money(u.realBalance)}</div>
              </div>
              <Badge label={u.kyc} tone={statusTone(u.kyc)} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
