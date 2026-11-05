import { useMemo, useState } from "react";
import { formatChange, formatPrice, marketCategories } from "../data";
import type { MarketCategory, MarketRow } from "../types";
import { useApp } from "../state/AppStore";
import { useToast } from "./Toast";
import { SearchIcon, StarIcon } from "./icons";

function Spark({ up, spark, className }: { up: boolean; spark: number[]; className?: string }) {
  const w = 58;
  const h = 22;
  const max = Math.max(...spark);
  const min = Math.min(...spark);
  const step = w / (spark.length - 1);
  const d = spark
    .map((p, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)} ${((max - p) / (max - min || 1)) * (h - 4) + 2}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} fill="none" aria-hidden>
      <path d={d} stroke={up ? "#17b26a" : "#ef4444"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MarketItem({ row, starred, selected, onStar, onSelect }: { row: MarketRow; starred: boolean; selected: boolean; onStar: () => void; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={`flex w-full items-center gap-2.5 rounded-[12px] px-2 py-2.5 text-left transition-colors active:bg-slate-50 ${
        selected ? "bg-emerald-50/70" : ""
      }`}
    >
      <div className="flex shrink-0 -space-x-1.5">
        <span className="z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] shadow-sm ring-1 ring-slate-100">
          {row.f1}
        </span>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] shadow-sm ring-1 ring-slate-100">
          {row.f2}
        </span>
      </div>
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="truncate text-[13px] font-extrabold text-slate-900">{row.name}</span>
        {selected && (
          <span className="shrink-0 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wide text-white">
            Trading
          </span>
        )}
      </span>
      <Spark up={row.up} spark={row.spark} className="h-5 w-14 shrink-0" />
      <div className="w-[64px] shrink-0 text-right">
        <div className="text-[12.5px] font-extrabold leading-none tabular-nums text-slate-900">{formatPrice(row)}</div>
        <div className={`mt-1 text-[11px] font-bold leading-none tabular-nums ${row.up ? "text-emerald-500" : "text-red-500"}`}>
          {formatChange(row)}
        </div>
      </div>
      <span
        role="button"
        aria-label={starred ? "Remove from favourites" : "Add to favourites"}
        onClick={(e) => {
          e.stopPropagation();
          onStar();
        }}
      >
        <StarIcon filled={starred} className={`h-4.5 w-4.5 shrink-0 ${starred ? "text-[#f5b301]" : "text-slate-300"}`} />
      </span>
    </button>
  );
}

function TopList({ title, tone, up, rows }: { title: string; tone: "gain" | "loss"; up: boolean; rows: MarketRow[] }) {
  const color = tone === "gain" ? "text-emerald-600" : "text-red-500";
  return (
    <div
      className={`rounded-[18px] p-2.5 ${tone === "gain" ? "bg-[#e9f9f0]" : "bg-[#fdecec]"}`}
      style={{ boxShadow: "3px 3px 8px rgba(166,180,200,.35), -3px -3px 8px rgba(255,255,255,.85)" }}
    >
      <div className={`flex items-center gap-1.5 text-[12.5px] font-extrabold ${color}`}>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/80 text-[10px]">
          {up ? "↗" : "↘"}
        </span>
        {title}
      </div>
      <div className="mt-1.5 space-y-1">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between text-[11.5px]">
            <span className="font-bold text-slate-700">{r.name}</span>
            <span className={`font-extrabold ${color}`}>{formatChange(r)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MarketsScreen({ onTrade }: { onTrade?: () => void }) {
  const { markets, pair, selectPair } = useApp();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<MarketCategory>("Forex");
  const [starred, setStarred] = useState<Set<string>>(new Set(["eurusd"]));

  const toggleStar = (id: string) =>
    setStarred((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const pickMarket = (row: MarketRow) => {
    selectPair(row.id);
    toast.success(`${row.name} selected`, "Loaded on your trading card — ready to trade.");
    onTrade?.();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return markets.filter(
      (m) => m.category === category && (!q || m.name.toLowerCase().includes(q)),
    );
  }, [query, category, markets]);

  const trending = filtered.slice(0, 6);
  const gainers = [...filtered].sort((a, b) => b.changePct - a.changePct).slice(0, 3);
  const losers = [...filtered].sort((a, b) => a.changePct - b.changePct).slice(0, 3);

  return (
    <div className="px-3 pb-3">
      <h2 className="mt-2 text-[21px] font-extrabold leading-tight text-slate-900">Markets</h2>
      <p className="text-[12px] font-medium text-slate-500">Explore global markets</p>

      {/* search */}
      <div className="neu mt-2.5 flex items-center gap-2 rounded-2xl bg-white px-3 py-2.5">
        <SearchIcon className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search markets..."
          className="w-full bg-transparent text-[13px] font-medium text-slate-800 outline-none placeholder:text-slate-400"
        />
      </div>

      {/* category chips */}
      <div className="mt-2.5 flex gap-2">
        {marketCategories.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[11.5px] font-bold transition-all active:scale-95 ${
              category === c ? "bg-emerald-600 text-white" : "neu-sm bg-white text-slate-600"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* trending */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-[14.5px] font-extrabold text-slate-900">Trending Markets 🔥</h3>
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wide text-emerald-600">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
        </div>
        <span className="text-[12px] font-bold text-emerald-600">{filtered.length} pairs</span>
      </div>
      <div className="neu mt-2 divide-y divide-slate-100 rounded-[20px] bg-white px-1.5 py-1">
        {trending.map((row) => (
          <MarketItem
            key={row.id}
            row={row}
            starred={starred.has(row.id)}
            selected={pair.id === row.id}
            onStar={() => toggleStar(row.id)}
            onSelect={() => pickMarket(row)}
          />
        ))}
        {trending.length === 0 && (
          <p className="px-3 py-6 text-center text-[12px] font-medium text-slate-400">
            No markets match "{query}" in {category}.
          </p>
        )}
      </div>

      {/* gainers / losers */}
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <TopList title="Top Gainers" tone="gain" up rows={gainers} />
        <TopList title="Top Losers" tone="loss" up={false} rows={losers} />
      </div>
    </div>
  );
}
