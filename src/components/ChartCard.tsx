import { useState } from "react";
import { useApp, TIMEFRAMES, type Timeframe } from "../state/AppStore";
import { CandleIcon, ChevronDownIcon, ExpandIcon, CloseIcon } from "./icons";

/* ---------- chart geometry (viewBox units, stretched to fit) ---------- */

const PLOT_W = 322;
const CHART_Y = 8;
const CHART_H = 150;
const VOL_Y = 168;
const VOL_H = 30;
const VIEW_H = VOL_Y + VOL_H + 4;

const TF_MINUTES: Record<string, number> = { "1m": 1, "15m": 15, "1H": 60, "4H": 240, "1D": 1440 };

/**
 * Build 5 time-axis labels that actually match the selected timeframe.
 * The rightmost candle is "now"; each candle back is one timeframe step.
 */
function buildTimeLabels(timeframe: string, candleCount: number): string[] {
  const stepMin = TF_MINUTES[timeframe] ?? 60;
  const slots = 5;
  const now = new Date();
  const labels: string[] = [];
  for (let s = 0; s < slots; s++) {
    // slot 0 = leftmost (oldest), slot 4 = rightmost (now)
    const candlesBack = Math.round(((slots - 1 - s) / (slots - 1)) * (candleCount - 1));
    const d = new Date(now.getTime() - candlesBack * stepMin * 60_000);
    if (stepMin >= 1440) {
      labels.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
    } else {
      const hh = d.getHours().toString().padStart(2, "0");
      const mm = d.getMinutes().toString().padStart(2, "0");
      labels.push(`${hh}:${mm}`);
    }
  }
  return labels;
}

function CandleChart({ lineMode }: { lineMode: boolean }) {
  const { candles, pair, timeframe } = useApp();
  const timeLabels = buildTimeLabels(timeframe, candles.length);

  const min = Math.min(...candles.map((c) => c.low));
  const max = Math.max(...candles.map((c) => c.high));
  const pad = (max - min) * 0.04;
  const lo = min - pad;
  const hi = max + pad;
  const lastClose = candles[candles.length - 1].close;

  const priceToY = (p: number) => CHART_Y + ((hi - p) / (hi - lo)) * CHART_H;
  const colW = PLOT_W / candles.length;
  const bodyW = colW * 0.58;
  const xOf = (i: number) => colW * i + colW / 2;

  // pick grid lines inside the visible range
  const step = (hi - lo) / 4;
  const gridAt = [1, 2, 3].map((k) => lo + k * step);
  const priceLabels = [lo + step, lo + 2 * step, lo + 3 * step, hi - step * 0.5];

  const lastY = (priceToY(lastClose) / VIEW_H) * 100;

  // line-mode path through the closes
  const linePath = candles
    .map((c, i) => `${i ? "L" : "M"}${xOf(i).toFixed(1)} ${priceToY(c.close).toFixed(1)}`)
    .join(" ");

  return (
    <div className="flex min-h-[90px] flex-1 flex-col pt-1">
      <div className="flex min-h-0 flex-1">
        {/* candle plot — stretches vertically with available space */}
        <div className="relative min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${PLOT_W} ${VIEW_H}`}
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            role="img"
            aria-label={`${pair.name} ${lineMode ? "line" : "candlestick"} chart`}
          >
            {/* horizontal grid */}
            {gridAt.map((t, i) => (
              <line
                key={i}
                x1="0"
                x2={PLOT_W}
                y1={priceToY(t)}
                y2={priceToY(t)}
                stroke="#eef2f7"
                strokeWidth="1"
              />
            ))}

            {/* volume bars */}
            {candles.map((c, i) => {
              const h = Math.max(1.5, (c.volume / 115) * VOL_H);
              return (
                <rect
                  key={`v${i}`}
                  x={xOf(i) - bodyW / 2}
                  y={VOL_Y + VOL_H - h}
                  width={bodyW}
                  height={h}
                  rx="1"
                  fill={c.close >= c.open ? "#d1f2e0" : "#fbd5d8"}
                />
              );
            })}

            {/* separator between price and volume */}
            <line x1="0" x2={PLOT_W} y1={VOL_Y - 4} y2={VOL_Y - 4} stroke="#e8edf3" strokeWidth="1" />

            {lineMode ? (
              <>
                <path
                  d={`${linePath} L${xOf(candles.length - 1)} ${VOL_Y - 4} L${xOf(0)} ${VOL_Y - 4} Z`}
                  fill="url(#line-fill)"
                  stroke="none"
                />
                <path d={linePath} fill="none" stroke="#22b866" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </>
            ) : (
              <>
                {/* candles: wicks then bodies */}
                {candles.map((c, i) => {
                  const up = c.close >= c.open;
                  const color = up ? "#22b866" : "#f04b4b";
                  return (
                    <line
                      key={`w${i}`}
                      x1={xOf(i)}
                      x2={xOf(i)}
                      y1={priceToY(c.high)}
                      y2={priceToY(c.low)}
                      stroke={color}
                      strokeWidth="1.1"
                    />
                  );
                })}
                {candles.map((c, i) => {
                  const up = c.close >= c.open;
                  const yA = priceToY(Math.max(c.open, c.close));
                  const yB = priceToY(Math.min(c.open, c.close));
                  return (
                    <rect
                      key={`b${i}`}
                      x={xOf(i) - bodyW / 2}
                      y={yA}
                      width={bodyW}
                      height={Math.max(1.2, yB - yA)}
                      rx="0.8"
                      fill={up ? "#22b866" : "#f04b4b"}
                    />
                  );
                })}
              </>
            )}

            {/* current price dashed line */}
            <line
              x1="0"
              x2={PLOT_W}
              y1={priceToY(lastClose)}
              y2={priceToY(lastClose)}
              stroke="#18a558"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
            <defs>
              <linearGradient id="line-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#17b26a" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#17b26a" stopOpacity="0.02" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* price axis (HTML overlay, crisp at any height) */}
        <div className="relative w-[70px] shrink-0">
          {priceLabels.map((t, i) => (
            <span
              key={i}
              className="absolute left-1.5 -translate-y-1/2 whitespace-nowrap text-[10px] font-semibold text-[#8b97a5]"
              style={{ top: `${(priceToY(t) / VIEW_H) * 100}%` }}
            >
              {t.toFixed(pair.digits)}
            </span>
          ))}
          <span
            className="absolute -left-1.5 flex -translate-y-1/2 items-center justify-center whitespace-nowrap rounded-md bg-[#109a53] px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm"
            style={{ top: `${lastY}%` }}
          >
            {lastClose.toFixed(pair.digits)}
          </span>
        </div>
      </div>

      {/* time axis */}
      <div className="flex justify-between pr-[70px] pt-1 text-[10px] font-semibold text-[#8b97a5]">
        {timeLabels.map((label, i) => (
          <span key={label + i}>{label}</span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ header controls ----------------------------- */

function ChartTypeToggle({ lineMode, setLineMode }: { lineMode: boolean; setLineMode: (v: boolean) => void }) {
  return (
    <button
      onClick={() => setLineMode(!lineMode)}
      aria-pressed={lineMode}
      aria-label={lineMode ? "Switch to candlestick chart" : "Switch to line chart"}
      className="neu-sm flex h-6.5 w-6.5 items-center justify-center rounded-full bg-white text-slate-700 active:scale-95"
    >
      {lineMode ? <TrendLineGlyph /> : <CandleIcon className="h-3.5 w-3.5" />}
    </button>
  );
}

function TrendLineGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <path d="M3 17 L9 11 L13 14 L21 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TimeframePicker({ tf, setTf }: { tf: Timeframe; setTf: (t: Timeframe) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="neu-sm flex h-6.5 items-center gap-0.5 rounded-full bg-white px-2 active:scale-95"
      >
        <span className="text-[11px] font-bold text-slate-900">{tf}</span>
        <ChevronDownIcon className={`h-2.5 w-2.5 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <button aria-label="Close timeframe picker" onClick={() => setOpen(false)} className="fixed inset-0 z-30 cursor-default" />
          <div
            role="listbox"
            aria-label="Select timeframe"
            className="absolute right-0 top-8 z-40 w-[110px] rounded-[14px] bg-white p-1 shadow-[0_16px_40px_rgba(15,40,30,0.25)] ring-1 ring-slate-100"
          >
            {TIMEFRAMES.map((t) => (
              <button
                key={t}
                role="option"
                aria-selected={t === tf}
                onClick={() => {
                  setTf(t);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-[10px] px-2.5 py-1.5 text-left text-[12px] font-extrabold ${
                  t === tf ? "bg-emerald-50 text-emerald-700" : "text-slate-800 active:bg-slate-50"
                }`}
              >
                {t}
                {t === tf && <span className="text-[10px]">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* --------------------------------- exports --------------------------------- */

export function ChartCard() {
  const { pair, selectPair, markets, timeframe, setTimeframe } = useApp();
  const [open, setOpen] = useState(false);
  const [lineMode, setLineMode] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const chart = (
    <section
      className={`neu flex flex-col rounded-[20px] bg-white p-2 ${
        expanded ? "h-full w-full rounded-none border-0" : "mx-3 mt-2 min-h-[240px] flex-1"
      }`}
    >
      {/* header */}
      <div className="flex items-center justify-between pb-1">
        <div className="relative flex min-w-0 items-center gap-1.5">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex min-w-0 items-center gap-1.5 rounded-full px-1 py-0.5 active:bg-slate-100"
            aria-expanded={open}
            aria-haspopup="listbox"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2563c9] text-[12px]">
              {pair.flag}
            </span>
            <span className="text-[13.5px] font-extrabold text-slate-900">{pair.name}</span>
            <ChevronDownIcon
              className={`h-3 w-3 text-slate-600 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
          <span
            className={`ml-0.5 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold ${
              pair.up ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-500"
            }`}
          >
            {pair.changeLabel} <span className="text-[8px]">{pair.up ? "▲" : "▼"}</span>
          </span>

          {open && (
            <>
              <button
                aria-label="Close market picker"
                onClick={() => setOpen(false)}
                className="fixed inset-0 z-30 cursor-default"
              />
              <div
                role="listbox"
                aria-label="Select market"
                className="absolute left-0 top-9 z-40 max-h-[240px] w-[220px] overflow-y-auto rounded-[16px] bg-white p-1.5 shadow-[0_16px_40px_rgba(15,40,30,0.25)] ring-1 ring-slate-100"
              >
                {markets.map((m) => (
                  <button
                    key={m.id}
                    role="option"
                    aria-selected={m.id === pair.id}
                    onClick={() => {
                      selectPair(m.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-[12px] px-2 py-1.5 text-left ${
                      m.id === pair.id ? "bg-emerald-50" : "active:bg-slate-50"
                    }`}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#eef1f6] text-[10px]">
                      {m.f1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] font-extrabold text-slate-900">
                      {m.name}
                    </span>
                    <span className={`text-[11px] font-bold ${m.up ? "text-emerald-500" : "text-red-500"}`}>
                      {m.changePct >= 0 ? "+" : ""}
                      {m.changePct.toFixed(2)}%
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <ChartTypeToggle lineMode={lineMode} setLineMode={setLineMode} />
          <TimeframePicker tf={timeframe} setTf={setTimeframe} />
          <button
            onClick={() => setExpanded((e) => !e)}
            aria-pressed={expanded}
            aria-label={expanded ? "Exit fullscreen chart" : "Expand chart fullscreen"}
            className="neu-sm flex h-6.5 w-6.5 items-center justify-center rounded-full bg-white text-slate-700 active:scale-95"
          >
            {expanded ? <CloseIcon className="h-3.5 w-3.5" /> : <ExpandIcon className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <CandleChart lineMode={lineMode} />
    </section>
  );

  if (expanded) {
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-[#eef1f6] p-2">
        {chart}
      </div>
    );
  }
  return chart;
}
