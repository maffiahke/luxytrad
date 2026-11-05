import { useEffect, useState } from "react";
import { useApp, DURATIONS, DEFAULT_DURATION, formatDuration } from "../state/AppStore";
import { ModalShell, Step, btnContinue, fieldLabel } from "./Sheet";
import { TrendArrowIcon, CheckIcon } from "./icons";

const LOT_PRESETS = [0.01, 0.05, 0.1, 0.5];

export function TradeTicket({ side, onClose }: { side: null | "Buy" | "Sell"; onClose: () => void }) {
  const { pair, placeTrade, balance } = useApp();
  const [lots, setLots] = useState(0.1);
  const [amount, setAmount] = useState("");
  const [duration, setDuration] = useState<number>(DEFAULT_DURATION);
  const [placed, setPlaced] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (side) {
      setPlaced(false);
      setBusy(false);
      setLots(0.1);
      setAmount("");
      setDuration(DEFAULT_DURATION);
    }
  }, [side]);

  const numericAmount = Number(amount) || 0;
  const margin = lots * 220;
  const affordable = margin <= balance;

  return (
    <ModalShell
      open={side !== null}
      onClose={onClose}
      title={`${side ?? ""} ${pair.name}`}
      subtitle={`Market execution · ${pair.price}`}
    >
      {placed ? (
        <Step>
          <div className="flex flex-col items-center px-2 py-4 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e7f8ef] text-emerald-600 animate-[pop-in_0.35s_cubic-bezier(.22,1.4,.36,1)]">
              <CheckIcon className="h-7 w-7" />
            </span>
            <h4 className="mt-2.5 text-[15px] font-extrabold text-slate-900">Order Placed</h4>
            <p className="mt-1 text-[11.5px] font-medium leading-relaxed text-slate-500">
              {side} {lots.toFixed(2)} lots of {pair.name} at {pair.price}. Track it under Portfolio → Open Contracts.
            </p>
            <button onClick={onClose} className={btnContinue}>
              Done
            </button>
          </div>
        </Step>
      ) : (
        <Step>
          <div className="py-1">
            <label className="mb-1 block text-[11.5px] font-bold text-slate-600">Volume (lots)</label>
            <div className="neu-sm flex items-center gap-2 rounded-[16px] bg-white px-3 py-2">
              <button
                onClick={() => setLots((l) => Math.max(0.01, Number((l - 0.01).toFixed(2))))}
                className="neu-sm flex h-8 w-8 items-center justify-center rounded-full bg-white text-[16px] font-extrabold text-slate-600"
                aria-label="Decrease lots"
              >
                −
              </button>
              <input
                inputMode="decimal"
                value={lots}
                onChange={(e) => {
                  const v = Number(e.target.value.replace(/[^0-9.]/g, ""));
                  setLots(Number.isFinite(v) ? v : 0);
                }}
                className="min-w-0 flex-1 bg-transparent text-center text-[21px] font-extrabold tracking-tight text-slate-900 outline-none"
              />
              <button
                onClick={() => setLots((l) => Number((l + 0.01).toFixed(2)))}
                className="neu-sm flex h-8 w-8 items-center justify-center rounded-full bg-white text-[16px] font-extrabold text-slate-600"
                aria-label="Increase lots"
              >
                +
              </button>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-1.5">
              {LOT_PRESETS.map((v) => (
                <button
                  key={v}
                  onClick={() => setLots(v)}
                  className={`rounded-[14px] py-2 text-[12px] font-extrabold transition-all active:scale-95 ${
                    lots === v
                      ? "bg-[linear-gradient(160deg,#10b981,#047857)] text-white shadow-[0_8px_16px_rgba(16,122,74,0.35)]"
                      : "neu-sm bg-white text-slate-700"
                  }`}
                >
                  {v.toFixed(2)}
                </button>
              ))}
            </div>

            <label className={`${fieldLabel} mt-3`}>Trade amount (USD)</label>
            <div className="neu-sm flex items-center gap-1.5 rounded-[16px] bg-white px-3.5 py-2">
              <span className="text-[17px] font-extrabold text-slate-400">$</span>
              <input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0"
                className="min-w-0 flex-1 bg-transparent text-[21px] font-extrabold tracking-tight text-slate-900 outline-none placeholder:text-slate-300"
              />
              <span className="shrink-0 rounded-full bg-[#e7f8ef] px-2 py-0.5 text-[9px] font-extrabold tracking-wide text-emerald-700">USD</span>
            </div>
            {numericAmount > 0 && (
              <p className="mt-1 text-[10.5px] font-semibold text-slate-500">
                ≈ {(numericAmount / 1000).toFixed(2)} standard lots at {pair.price}
              </p>
            )}

            <label className={`${fieldLabel} mt-3`}>Trade duration</label>
            <div className="flex gap-1.5">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  aria-pressed={duration === d}
                  className={`flex-1 rounded-[12px] py-1.5 text-[11px] font-extrabold transition-all active:scale-95 ${
                    duration === d
                      ? "bg-[linear-gradient(160deg,#10b981,#047857)] text-white shadow-[0_6px_12px_rgba(16,122,74,0.3)]"
                      : "neu-sm bg-white text-slate-700"
                  }`}
                >
                  {formatDuration(d)}
                </button>
              ))}
            </div>

            <div className="mt-3 space-y-1.5 rounded-[16px] bg-white p-3 text-[12px] font-semibold text-slate-600 neu">
              <div className="flex justify-between">
                <span>Expiry</span>
                <span className="font-extrabold text-slate-900">{formatDuration(duration)}</span>
              </div>
              <div className="flex justify-between">
                <span>Required margin</span>
                <span className="font-extrabold text-slate-900">${margin.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Free balance</span>
                <span className="font-extrabold text-slate-900">${balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span>Direction</span>
                <span className={`flex items-center gap-1 font-extrabold ${side === "Buy" ? "text-emerald-600" : "text-red-500"}`}>
                  <TrendArrowIcon className="h-3.5 w-3.5" down={side !== "Buy"} />
                  {side}
                </span>
              </div>
            </div>

            {!affordable && (
              <p className="mt-2 text-center text-[11px] font-bold text-red-500">
                Not enough free margin for this volume.
              </p>
            )}

            <button
              disabled={!affordable || lots <= 0 || busy}
              onClick={async () => {
                if (!side || busy) return;
                setBusy(true);
                const stake = numericAmount > 0 ? numericAmount : lots;
                const ok = await placeTrade(side, stake, duration);
                setBusy(false);
                if (ok) setPlaced(true);
              }}
              className={`${btnContinue} disabled:opacity-40`}
            >
              {side === "Buy" ? "Buy" : "Sell"} {lots.toFixed(2)} lots at {pair.price}
            </button>
          </div>
        </Step>
      )}
    </ModalShell>
  );
}
