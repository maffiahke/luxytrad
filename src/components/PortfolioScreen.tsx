import { useMemo, useState } from "react";
import { useApp } from "../state/AppStore";
import { markets as staticMarkets } from "../data";
import { ChevronDownIcon, EyeIcon, MarketsIcon, TargetIcon, TrophyIcon, TrendArrowIcon, WalletIcon } from "./icons";

const TABS = ["Overview", "Open", "Closed", "Pending"] as const;

const money = (n: number) => `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const FLAG: Record<string, string> = Object.fromEntries(staticMarkets.map((m) => [m.name, m.f1]));

type ChartDatum = { label: string; value: number };

function PerformanceChart({ data }: { data: ChartDatum[] }) {
  const w = 300;
  const h = 120;
  const padL = 10;
  const padR = 6;
  const padT = 8;
  const padB = 18;
  const values = data.map((d) => d.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const span = max - min || 1;
  const px = (i: number) => padL + (i * (w - padL - padR)) / Math.max(1, data.length - 1);
  const py = (v: number) => padT + ((max - v) / span) * (h - padT - padB);
  const line = data.map((d, i) => `${i ? "L" : "M"}${px(i).toFixed(1)} ${py(d.value).toFixed(1)}`).join(" ");
  const area = data.length ? `${line} L${px(data.length - 1)} ${h - padB} L${px(0)} ${h - padB} Z` : "";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full" role="img" aria-label="Cumulative performance">
      <defs>
        <linearGradient id="perf-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#17b26a" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#17b26a" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((g) => {
        const v = max - g * span;
        return <line key={g} x1={padL} x2={w - padR} y1={py(v)} y2={py(v)} stroke="#eef2f7" strokeWidth="1" />;
      })}
      {area && <path d={area} fill="url(#perf-fill)" />}
      {data.length > 1 && <path d={line} fill="none" stroke="#17b26a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
      {data.map((d, i) => (
        <circle key={i} cx={px(i)} cy={py(d.value)} r="3" fill="#fff" stroke="#17b26a" strokeWidth="2" />
      ))}
      {data.length === 0 && (
        <text x={w / 2} y={h / 2} fontSize="10" fontWeight="700" fill="#9aa7b4" textAnchor="middle">
          No closed trades yet
        </text>
      )}
    </svg>
  );
}

export function PortfolioScreen() {
  const { balance, activeAccount, switchAccount, positions, pnlOf, closePosition, settled, ledger: allLedger } = useApp();
  const [tab, setTab] = useState(0);

  const closed = settled;
  const ledger = useMemo(() => allLedger.slice(0, 8), [allLedger]);

  const stats = useMemo(() => {
    const wins = closed.filter((p) => (p.pnl ?? 0) >= 0).length;
    const realized = closed.reduce((s, p) => s + (p.pnl ?? 0), 0);
    const unrealized = positions.reduce((s, p) => s + pnlOf(p).value, 0);
    return {
      equity: balance + unrealized,
      realized,
      winRate: closed.length ? Math.round((wins / closed.length) * 100) : 0,
      totalTrades: closed.length + positions.length,
    };
  }, [closed, positions, balance]); // eslint-disable-line react-hooks/exhaustive-deps

  const chart = useMemo<ChartDatum[]>(() => {
    const ordered = [...closed].sort(
      (a, b) => (a.openedAt ? Date.parse(a.openedAt) : 0) - (b.openedAt ? Date.parse(b.openedAt) : 0),
    );
    if (ordered.length === 0) return [];
    let cum = 0;
    return ordered.map((p, i) => {
      cum += p.pnl ?? 0;
      return { label: `#${i + 1}`, value: cum };
    });
  }, [closed]);

  const gridStats = [
    { Icon: TargetIcon, label: "Total Equity", value: money(stats.equity) },
    { Icon: WalletIcon, label: "Free Margin", value: money(balance) },
    { Icon: MarketsIcon, label: "Total Trades", value: String(stats.totalTrades) },
    { Icon: TrophyIcon, label: "Win Rate", value: `${stats.winRate}%` },
  ];

  const showOpen = tab === 0 || tab === 1;
  const showClosed = tab === 0 || tab === 2;
  const showActivity = tab === 0 || tab === 3;

  return (
    <div className="px-3 pb-3">
      {/* filter chips + account toggle */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex gap-2">
          {TABS.map((c, i) => (
            <button
              key={c}
              onClick={() => setTab(i)}
              className={`neu-sm whitespace-nowrap rounded-full px-3.5 py-1.5 text-[11.5px] font-bold transition-colors ${
                i === tab ? "bg-emerald-600 text-white" : "bg-white text-slate-600"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 inline-flex rounded-full bg-slate-100 p-0.5 text-[10.5px] font-bold">
        {(["real", "demo"] as const).map((a) => (
          <button
            key={a}
            onClick={() => switchAccount(a)}
            className={`rounded-full px-3 py-1 capitalize transition-colors ${activeAccount === a ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500"}`}
          >
            {a}
          </button>
        ))}
      </div>

      {/* account balance */}
      <section className="neu mt-3 flex items-center gap-2 rounded-[20px] bg-white p-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500">
            {activeAccount === "real" ? "Real" : "Demo"} Balance <EyeIcon className="h-3.5 w-3.5 text-slate-400" />
          </div>
          <div className="mt-1 text-[24px] font-extrabold leading-none tracking-tight text-slate-900">{money(balance)}</div>
          <div className={`mt-1.5 flex items-center gap-1 text-[11.5px] font-extrabold ${stats.realized >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            ▲ {stats.realized >= 0 ? "+" : "-"}{money(stats.realized)} realized
          </div>
        </div>
      </section>

      {/* stat grid */}
      <section className="mt-2.5 grid grid-cols-2 gap-2.5">
        {gridStats.map(({ Icon, label, value }) => (
          <div key={label} className="neu rounded-[18px] bg-white p-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e7f8ef] text-emerald-600">
              <Icon className="h-4 w-4" />
            </span>
            <div className="mt-1.5 text-[11.5px] font-semibold text-slate-500">{label}</div>
            <div className="mt-0.5 text-[16px] font-extrabold leading-none text-slate-900">{value}</div>
          </div>
        ))}
      </section>

      {/* performance */}
      <section className="neu mt-2.5 rounded-[20px] bg-white p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-extrabold text-slate-900">Performance</h3>
          <button className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
            Trades <ChevronDownIcon className="h-2.5 w-2.5" />
          </button>
        </div>
        <PerformanceChart data={chart} />
      </section>

      {/* open contracts */}
      {showOpen && (
        <>
          <div className="mt-3 flex items-center justify-between px-1">
            <h3 className="text-[14px] font-extrabold text-slate-900">Open Contracts</h3>
            <span className="text-[12px] font-bold text-emerald-600">{positions.length} active ›</span>
          </div>
          {positions.length === 0 ? (
            <section className="neu mt-1.5 rounded-[20px] bg-white p-4 text-center text-[11.5px] font-medium text-slate-400">
              No open positions on this account.
            </section>
          ) : (
            <section className="neu mt-1.5 divide-y divide-slate-100 rounded-[20px] bg-white p-1.5">
              {positions.map((c) => {
                const pnl = pnlOf(c);
                return (
                  <div key={c.id} className="flex items-center gap-2.5 px-2 py-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef1f6] text-[13px] shadow-sm">
                      {FLAG[c.pair] ?? "💱"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-extrabold text-slate-900">{c.pair}</span>
                        <span className={`text-[11px] font-extrabold ${c.side === "Buy" ? "text-emerald-600" : "text-red-500"}`}>{c.side}</span>
                      </div>
                      <div className="mt-0.5 text-[10.5px] font-medium text-slate-500">
                        ${c.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} · {c.entry.toFixed(c.digits)}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`text-[13px] font-extrabold ${pnl.positive ? "text-emerald-600" : "text-red-500"}`}>
                        {pnl.positive ? "+" : "-"}
                        {money(pnl.value)}
                      </span>
                      <button onClick={() => closePosition(c.id)} className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600 active:scale-95">
                        Close
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>
          )}
        </>
      )}

      {/* closed trades */}
      {showClosed && closed.length > 0 && (
        <>
          <div className="mt-3 flex items-center justify-between px-1">
            <h3 className="text-[14px] font-extrabold text-slate-900">Closed Trades</h3>
            <span className="text-[12px] font-bold text-emerald-600">{closed.length} ›</span>
          </div>
          <section className="neu mt-1.5 divide-y divide-slate-100 rounded-[20px] bg-white p-1.5">
            {closed.slice(0, 8).map((p) => {
              const value = p.pnl ?? 0;
              const positive = value >= 0;
              return (
                <div key={p.id} className="flex items-center gap-2.5 px-2 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef1f6] text-[13px] shadow-sm">{FLAG[p.market] ?? "💱"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-extrabold text-slate-900">{p.market}</span>
                      <span className={`text-[11px] font-extrabold ${p.side === "BUY" ? "text-emerald-600" : "text-red-500"}`}>{p.side === "BUY" ? "Buy" : "Sell"}</span>
                    </div>
                    <div className="mt-0.5 text-[10.5px] font-medium text-slate-500">
                      ${p.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <span className={`shrink-0 text-[13px] font-extrabold ${positive ? "text-emerald-600" : "text-red-500"}`}>
                    {positive ? "+" : "-"}
                    {money(value)}
                  </span>
                </div>
              );
            })}
          </section>
        </>
      )}

      {/* recent activity (ledger) */}
      {showActivity && (
        <>
          <div className="mt-3 flex items-center justify-between px-1">
            <h3 className="text-[14px] font-extrabold text-slate-900">Recent Activity</h3>
          </div>
          <section className="neu mt-1.5 divide-y divide-slate-100 rounded-[20px] bg-white p-1.5">
            {ledger.length === 0 && (
              <div className="px-3 py-4 text-center text-[11.5px] font-medium text-slate-400">No account activity yet.</div>
            )}
            {ledger.map((l) => {
              const up = l.amount >= 0;
              return (
                <div key={l.id} className="flex items-center gap-2.5 px-2 py-2.5">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${up ? "bg-[#e7f8ef] text-emerald-600" : "bg-[#fde4e7] text-red-500"}`}>
                    <TrendArrowIcon className={`h-4 w-4 ${up ? "" : "rotate-180"}`} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-extrabold text-slate-900">{l.note || l.type}</div>
                    <div className="text-[10.5px] font-medium capitalize text-slate-500">{l.type.replace("_", " ").toLowerCase()}</div>
                  </div>
                  <span className={`shrink-0 text-[13px] font-extrabold ${up ? "text-emerald-600" : "text-red-500"}`}>
                    {up ? "+" : "-"}
                    {money(l.amount)}
                  </span>
                </div>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
}
