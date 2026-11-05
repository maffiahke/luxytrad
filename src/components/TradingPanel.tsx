import { useState } from "react";
import { useApp, DURATIONS, DEFAULT_DURATION, formatDuration, formatCountdown } from "../state/AppStore";
import { TrendArrowIcon, ClockIcon, ChevronDownIcon } from "./icons";

const AMOUNT_PRESETS = [50, 100, 250, 500];

export function TradingPanel() {
  const { placeTrade, balance, pnlOf, positions, closePosition, now, runs, activeAccount } = useApp();
  const [amount, setAmount] = useState<number>(100);
  const [custom, setCustom] = useState("");
  const [duration, setDuration] = useState<number>(DEFAULT_DURATION);
  const [durOpen, setDurOpen] = useState(false);
  const [run, setRun] = useState<number>(1);
  const [busy, setBusy] = useState(false);

  const numericCustom = Number(custom) || 0;
  const activeAmount = custom ? numericCustom : amount;
  const affordable = activeAmount > 0 && activeAmount <= balance;

  const activeRun = runs.find((r) => r.account === activeAccount) ?? null;

  const fire = async (side: "Buy" | "Sell") => {
    if (busy) return;
    setBusy(true);
    const ok = await placeTrade(side, activeAmount, duration, run);
    setBusy(false);
    if (ok) setCustom("");
  };

  return (
    <section className="neu mx-3 my-1.5 rounded-[20px] bg-white p-2.5">
      {/* amount tabs */}
      <div className="flex items-center justify-between">
        <label className="text-[11.5px] font-bold text-slate-600">Trade amount</label>
        <span className="text-[10px] font-semibold text-slate-400">
          Free ${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </span>
      </div>
      <div className="mt-1 grid grid-cols-5 gap-1.5">
        {AMOUNT_PRESETS.map((v) => {
          const active = !custom && amount === v;
          return (
            <button
              key={v}
              onClick={() => {
                setAmount(v);
                setCustom("");
              }}
              aria-pressed={active}
              className={`rounded-[12px] py-2 text-[11.5px] font-extrabold transition-all active:scale-95 ${
                active
                  ? "bg-[linear-gradient(160deg,#10b981,#047857)] text-white shadow-[0_6px_12px_rgba(16,122,74,0.3)]"
                  : "neu-sm bg-white text-slate-700"
              }`}
            >
              ${v.toLocaleString("en-US")}
            </button>
          );
        })}
        <input
          inputMode="decimal"
          value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="Custom"
          aria-label="Custom amount"
          className={`min-w-0 rounded-[12px] px-1 py-2 text-center text-[11.5px] font-extrabold outline-none transition-all ${
            custom
              ? "bg-[linear-gradient(160deg,#10b981,#047857)] text-white shadow-[0_6px_12px_rgba(16,122,74,0.3)] placeholder:text-emerald-50"
              : "neu-sm bg-white text-slate-700 placeholder:text-slate-400"
          }`}
        />
      </div>

      {/* duration: dropdown + adjustable trade run */}
      <div className="mt-2.5">
        <div className="flex items-center justify-between">
          <label className="text-[11.5px] font-bold text-slate-600">Trade duration</label>
          <span className="text-[10px] font-semibold text-slate-400">Auto-settles at expiry</span>
        </div>
        <div className="mt-1 flex items-center gap-2.5">
          {/* preset dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => setDurOpen((o) => !o)}
              aria-expanded={durOpen}
              aria-haspopup="listbox"
              className="neu-sm flex items-center gap-1.5 rounded-[12px] bg-white px-2.5 py-2 active:scale-95"
            >
              <ClockIcon className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-[12px] font-extrabold tabular-nums text-slate-900">
                {DURATIONS.includes(duration as (typeof DURATIONS)[number]) ? formatDuration(duration) : `${duration}s`}
              </span>
              <ChevronDownIcon className={`h-2.5 w-2.5 text-slate-500 transition-transform ${durOpen ? "rotate-180" : ""}`} />
            </button>
            {durOpen && (
              <>
                <button aria-label="Close duration picker" onClick={() => setDurOpen(false)} className="fixed inset-0 z-30 cursor-default" />
                <div
                  role="listbox"
                  aria-label="Select trade duration"
                  className="absolute left-0 top-11 z-40 w-[120px] rounded-[14px] bg-white p-1 shadow-[0_16px_40px_rgba(15,40,30,0.25)] ring-1 ring-slate-100"
                >
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      role="option"
                      aria-selected={d === duration}
                      onClick={() => {
                        setDuration(d);
                        setDurOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-[10px] px-2.5 py-1.5 text-left text-[12px] font-extrabold ${
                        d === duration ? "bg-emerald-50 text-emerald-700" : "text-slate-800 active:bg-slate-50"
                      }`}
                    >
                      {formatDuration(d)}
                      {d === duration && <span className="text-[10px]">✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* adjustable trade run: number of trades to run */}
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Trade run</span>
              <span className="text-[10px] font-semibold text-slate-400">no. of trades</span>
            </div>
            <div className="neu-sm flex items-center justify-between rounded-[12px] bg-white px-1.5 py-1">
              <button
                type="button"
                onClick={() => setRun((r) => Math.max(1, r - 1))}
                disabled={run <= 1}
                aria-label="Decrease number of trades"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[9px] text-[16px] font-extrabold text-slate-600 transition-all active:scale-90 disabled:opacity-30"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={50}
                step={1}
                value={run}
                onChange={(e) => {
                  const v = Math.floor(Number(e.target.value));
                  setRun(Number.isFinite(v) && v >= 1 ? Math.min(50, v) : 1);
                }}
                aria-label="Number of trades to run"
                className="w-full min-w-0 bg-transparent text-center text-[14px] font-extrabold tabular-nums text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => setRun((r) => Math.min(50, r + 1))}
                disabled={run >= 50}
                aria-label="Increase number of trades"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[9px] text-[16px] font-extrabold text-emerald-600 transition-all active:scale-90 disabled:opacity-30"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* buy / sell */}
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <button
          onClick={() => fire("Buy")}
          disabled={!affordable}
          className="flex items-center justify-center gap-2 py-2.5 text-white transition-transform active:scale-[0.97] disabled:opacity-40 neu-buy"
        >
          <TrendArrowIcon className="h-[18px] w-[18px]" />
          <span className="text-[15px] font-extrabold leading-none">
            Buy <span className="text-[11px] font-bold opacity-90">${activeAmount > 0 ? activeAmount.toLocaleString("en-US") : "0"} · {formatDuration(duration)}{run > 1 ? ` · ×${run}` : ""}</span>
          </span>
        </button>
        <button
          onClick={() => fire("Sell")}
          disabled={!affordable}
          className="flex items-center justify-center gap-2 py-2.5 text-white transition-transform active:scale-[0.97] disabled:opacity-40 neu-sell"
        >
          <TrendArrowIcon className="h-[18px] w-[18px]" down />
          <span className="text-[15px] font-extrabold leading-none">
            Sell <span className="text-[11px] font-bold opacity-90">${activeAmount > 0 ? activeAmount.toLocaleString("en-US") : "0"} · {formatDuration(duration)}{run > 1 ? ` · ×${run}` : ""}</span>
          </span>
        </button>
      </div>

      {!affordable && (
        <p className="mt-1.5 text-center text-[10.5px] font-bold text-red-500">
          {activeAmount <= 0
            ? "Enter a trade amount to continue."
            : `Not enough free balance — need $${activeAmount.toLocaleString("en-US")}, available $${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}.`}
        </p>
      )}

      {/* sequential run progress */}
      {activeRun && activeRun.total > 1 && (
        <div className="mt-2 flex items-center justify-between rounded-[12px] bg-[#e7f8ef] px-3 py-2">
          <span className="flex items-center gap-1.5 text-[11px] font-extrabold text-emerald-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            Running {activeRun.side} {activeRun.pair} · Trade {activeRun.total - activeRun.remaining} of {activeRun.total}
          </span>
          <span className="text-[10px] font-bold text-emerald-600">
            {activeRun.remaining > 0 ? `${activeRun.remaining} queued` : "last trade"}
          </span>
        </div>
      )}

      {/* open positions from this panel */}
      {positions.length > 0 && (
        <div className="mt-2 divide-y divide-slate-100 rounded-[14px] bg-[#f8fafc] px-2.5">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Open positions</span>
            <span className="text-[10px] font-bold text-slate-400">{positions.length}</span>
          </div>
          {positions.map((p) => {
            const { value, positive } = pnlOf(p);
            const remaining = Math.max(0, p.expiresAt - now);
            const progress = p.duration > 0 ? Math.min(1, remaining / (p.duration * 1000)) : 0;
            return (
              <div key={p.id} className="py-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-extrabold ${p.side === "Buy" ? "text-emerald-600" : "text-red-500"}`}
                  >
                    {p.side.toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11.5px] font-extrabold text-slate-900">{p.pair}</span>
                  <span className="text-[10.5px] font-semibold text-slate-500">
                    ${p.amount.toLocaleString("en-US")}
                  </span>
                  <span
                    className={`w-[64px] shrink-0 text-right text-[11.5px] font-extrabold ${positive ? "text-emerald-500" : "text-red-500"}`}
                  >
                    {positive ? "+" : "-"}${Math.abs(value).toFixed(2)}
                  </span>
                  <button
                    onClick={() => closePosition(p.id)}
                    className="shrink-0 rounded-full bg-slate-900 px-2 py-0.5 text-[9.5px] font-extrabold text-white active:scale-95"
                  >
                    Close
                  </button>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="shrink-0 rounded-full bg-[#e7f8ef] px-1.5 py-0.5 text-[9.5px] font-extrabold tabular-nums text-emerald-700">
                    {formatCountdown(remaining)}
                  </span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#10b981,#047857)] transition-[width] duration-500 ease-linear"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-[9.5px] font-bold text-slate-400">{formatDuration(p.duration)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
