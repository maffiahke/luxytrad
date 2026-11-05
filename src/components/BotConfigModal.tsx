import { useMemo, useState } from "react";
import { useApp, DURATIONS, DEFAULT_DURATION, formatDuration, type BotInit } from "../state/AppStore";
import { ModalShell, Step, btnContinue, fieldLabel } from "./Sheet";
import { ClockIcon, ChevronDownIcon, TrendArrowIcon, TargetIcon, ShieldIcon, CrownIcon, Robot, CheckIcon } from "./icons";

const STAKE_PRESETS = [50, 100, 250, 500];
const RUN_PRESETS = [5, 10, 20];

/** Bottom-sheet configuration for the auto-trading bot. Mirrors the plan's modal
 *  fields: market, stake (min $50), duration, runs, take-profit, stop-loss,
 *  early-close, repeat — direction is fixed to momentum in v1. */
export function BotConfigModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { markets, activeAccount, balance, botMinStake, startBot } = useApp();

  const [market, setMarket] = useState(markets[0]?.name ?? "EUR/USD");
  const [mktOpen, setMktOpen] = useState(false);
  const [stake, setStake] = useState<number>(50);
  const [custom, setCustom] = useState("");
  const [duration, setDuration] = useState<number>(DEFAULT_DURATION);
  const [durOpen, setDurOpen] = useState(false);
  const [total, setTotal] = useState(10);
  const [takeProfit, setTakeProfit] = useState(200);
  const [stopLoss, setStopLoss] = useState(100);
  const [earlyClose, setEarlyClose] = useState(false);
  const [repeat, setRepeat] = useState(true);

  const activeStake = custom ? Math.floor(Number(custom) || 0) : stake;
  const belowMin = activeStake < botMinStake;
  const overBalance = activeStake > balance;

  const selected = useMemo(() => markets.find((m) => m.name === market), [markets, market]);

  const [busy, setBusy] = useState(false);

  const commit = async () => {
    if (busy) return;
    const cfg: BotInit = {
      market,
      stake: activeStake,
      duration,
      total: Math.max(1, Math.min(50, Math.floor(total) || 1)),
      repeat,
      takeProfit: Math.max(0, takeProfit || 0),
      stopLoss: Math.max(0, stopLoss || 0),
      earlyClose,
    };
    setBusy(true);
    const ok = await startBot(cfg);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Trading Bot"
      subtitle="Auto-trades by momentum — you set the guard rails"
    >
      <Step>
        {/* market */}
        <label className={fieldLabel}>Market</label>
        <div className="relative">
          <button
            onClick={() => setMktOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={mktOpen}
            className="neu-sm flex w-full items-center justify-between rounded-[14px] bg-white px-3 py-2.5 active:scale-[0.99]"
          >
            <span className="flex items-center gap-2 text-[13px] font-extrabold text-slate-900">
              <span className="text-[15px]">{selected?.f1 ?? "📈"}</span>
              {market}
            </span>
            <ChevronDownIcon className={`h-3 w-3 text-slate-500 transition-transform ${mktOpen ? "rotate-180" : ""}`} />
          </button>
          {mktOpen && (
            <>
              <button aria-label="Close market picker" onClick={() => setMktOpen(false)} className="fixed inset-0 z-30 cursor-default" />
              <div
                role="listbox"
                aria-label="Select market"
                className="absolute left-0 right-0 top-11 z-40 max-h-[220px] overflow-y-auto rounded-[14px] bg-white p-1 shadow-[0_16px_40px_rgba(15,40,30,0.25)] ring-1 ring-slate-100"
              >
                {markets.map((m) => (
                  <button
                    key={m.id}
                    role="option"
                    aria-selected={m.name === market}
                    onClick={() => {
                      setMarket(m.name);
                      setMktOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-[10px] px-2.5 py-1.5 text-left ${
                      m.name === market ? "bg-emerald-50" : "active:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-[12.5px] font-extrabold text-slate-900">
                      <span className="text-[14px]">{m.f1}</span>
                      {m.name}
                    </span>
                    <span className={`text-[11px] font-bold tabular-nums ${m.up ? "text-emerald-600" : "text-red-500"}`}>
                      {m.up ? "+" : ""}
                      {m.changePct.toFixed(2)}%
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* stake */}
        <div className="mt-3 flex items-center justify-between">
          <label className={fieldLabel}>Stake per trade</label>
          <span className="mb-1 text-[10px] font-semibold text-slate-400">min ${botMinStake}</span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {STAKE_PRESETS.map((v) => {
            const active = !custom && stake === v;
            return (
              <button
                key={v}
                onClick={() => {
                  setStake(v);
                  setCustom("");
                }}
                aria-pressed={active}
                className={`rounded-[12px] py-2 text-[12px] font-extrabold transition-all active:scale-95 ${
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
            aria-label="Custom stake"
            className={`min-w-0 rounded-[12px] px-1 py-2 text-center text-[12px] font-extrabold outline-none transition-all ${
              custom
                ? "bg-[linear-gradient(160deg,#10b981,#047857)] text-white placeholder:text-emerald-50"
                : "neu-sm bg-white text-slate-700 placeholder:text-slate-400"
            }`}
          />
        </div>
        {belowMin && (
          <p className="mt-1 text-[10.5px] font-bold text-red-500">The bot only trades with a minimum of ${botMinStake}.</p>
        )}
        {!belowMin && overBalance && (
          <p className="mt-1 text-[10.5px] font-bold text-red-500">
            ${activeStake.toLocaleString("en-US")} exceeds your {activeAccount} balance (${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}).
          </p>
        )}

        {/* duration + runs */}
        <div className="mt-3 flex items-end gap-2.5">
          <div className="relative shrink-0">
            <label className={fieldLabel}>Duration</label>
            <button
              onClick={() => setDurOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={durOpen}
              className="neu-sm mt-0 flex items-center gap-1.5 rounded-[12px] bg-white px-3 py-2.5 active:scale-95"
            >
              <ClockIcon className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-[13px] font-extrabold tabular-nums text-slate-900">
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
                  className="absolute left-0 top-[62px] z-40 w-[110px] rounded-[14px] bg-white p-1 shadow-[0_16px_40px_rgba(15,40,30,0.25)] ring-1 ring-slate-100"
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

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between">
              <label className="mb-0 text-[11.5px] font-bold text-slate-600">Number of runs</label>
              <span className="text-[10px] font-semibold text-slate-400">1–50</span>
            </div>
            <div className="flex items-center gap-1.5">
              {RUN_PRESETS.map((v) => (
                <button
                  key={v}
                  onClick={() => setTotal(v)}
                  aria-pressed={total === v}
                  className={`flex-1 rounded-[12px] py-2 text-[12px] font-extrabold transition-all active:scale-95 ${
                    total === v
                      ? "bg-slate-900 text-white"
                      : "neu-sm bg-white text-slate-700"
                  }`}
                >
                  ×{v}
                </button>
              ))}
              <input
                type="number"
                min={1}
                max={50}
                step={1}
                value={total}
                onChange={(e) => {
                  const v = Math.floor(Number(e.target.value));
                  setTotal(Number.isFinite(v) && v >= 1 ? Math.min(50, v) : 1);
                }}
                aria-label="Number of runs"
                className="neu-sm w-[52px] min-w-0 rounded-[12px] bg-white px-1 py-2 text-center text-[12px] font-extrabold tabular-nums text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>
        </div>

        {/* guard rails */}
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div>
            <label className={fieldLabel}>
              <span className="flex items-center gap-1"><TargetIcon className="h-3.5 w-3.5 text-emerald-600" />Take profit ($)</span>
            </label>
            <input
              inputMode="numeric"
              value={takeProfit}
              onChange={(e) => setTakeProfit(Math.max(0, Math.floor(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)))}
              aria-label="Take profit in dollars"
              className="neu-sm w-full rounded-[12px] bg-white px-3 py-2 text-[13px] font-extrabold tabular-nums text-slate-900 outline-none"
            />
            <span className="mt-0.5 block text-[9.5px] font-semibold text-slate-400">0 = off · stops at +${takeProfit || 0}</span>
          </div>
          <div>
            <label className={fieldLabel}>
              <span className="flex items-center gap-1"><ShieldIcon className="h-3.5 w-3.5 text-red-500" />Stop loss ($)</span>
            </label>
            <input
              inputMode="numeric"
              value={stopLoss}
              onChange={(e) => setStopLoss(Math.max(0, Math.floor(Number(e.target.value.replace(/[^0-9]/g, "")) || 0)))}
              aria-label="Stop loss in dollars"
              className="neu-sm w-full rounded-[12px] bg-white px-3 py-2 text-[13px] font-extrabold tabular-nums text-slate-900 outline-none"
            />
            <span className="mt-0.5 block text-[9.5px] font-semibold text-slate-400">0 = off · halts at -${stopLoss || 0}</span>
          </div>
        </div>

        {/* toggles */}
        <div className="mt-3 space-y-1.5">
          <ToggleRow
            label="Early close"
            hint="Book a trade at TP/SL before it expires"
            checked={earlyClose}
            onChange={setEarlyClose}
          />
          <ToggleRow label="Repeat after batch" hint="Re-arm the runs once they complete" checked={repeat} onChange={setRepeat} />
        </div>

        {/* direction (fixed) */}
        <div className="mt-3 flex items-center gap-2 rounded-[12px] bg-[#e7f8ef] px-3 py-2">
          <TrendArrowIcon className="h-4 w-4 text-emerald-600" />
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-extrabold text-emerald-800">Momentum auto-direction</div>
            <div className="text-[10px] font-medium text-emerald-700/80">Buys when price trends up, sells when it trends down</div>
          </div>
          <CrownIcon className="h-3.5 w-3.5 text-[#f7c948]" />
        </div>

        {/* cost preview */}
        <div className="mt-3 flex items-center justify-between rounded-[14px] bg-slate-900 px-3.5 py-2.5 text-white">
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-200">
            <Robot className="h-4 w-4" />
            Max exposure
          </span>
          <span className="text-[13px] font-extrabold tabular-nums">
            ${(activeStake * (total || 1)).toLocaleString("en-US")}
            <span className="ml-1 text-[10px] font-semibold text-slate-300">
              {activeStake.toLocaleString("en-US")} × {total}
            </span>
          </span>
        </div>

        <button onClick={commit} disabled={belowMin || overBalance || activeStake <= 0 || busy} className={`${btnContinue} disabled:opacity-40`}>
          <CheckIcon className="h-4 w-4" />
          Start Bot
        </button>
      </Step>
    </ModalShell>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      className="neu-sm flex w-full items-center justify-between rounded-[14px] bg-white px-3 py-2 text-left active:scale-[0.99]"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-extrabold text-slate-900">{label}</span>
        <span className="block text-[10px] font-medium text-slate-500">{hint}</span>
      </span>
      <span
        className={`ml-2 flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          checked ? "bg-emerald-500" : "bg-slate-300"
        }`}
      >
        <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </span>
    </button>
  );
}
