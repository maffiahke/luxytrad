import { useMemo, useState } from "react";
import { COUNTRIES, type Country } from "../data/countries";
import { ChevronDownIcon, SearchIcon, CheckIcon } from "./icons";
import { ModalShell } from "./Sheet";

/** Compact flag + dial-code trigger used inline inside the phone field. */
export function CountryTrigger({
  country,
  onClick,
  ariaLabel,
}: {
  country: Country;
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? `Select country, currently ${country.name}`}
      className="flex shrink-0 items-center gap-1 rounded-[10px] px-1.5 py-1 text-slate-700 transition-colors hover:bg-slate-50 active:scale-95"
    >
      <span className="text-[17px] leading-none">{country.flag}</span>
      <span className="text-[13px] font-extrabold tabular-nums">{country.dial}</span>
      <ChevronDownIcon className="h-3 w-3 text-slate-400" />
    </button>
  );
}

/** Full searchable country picker rendered as a bottom sheet. */
export function CountryPicker({
  open,
  onClose,
  value,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  value: Country;
  onSelect: (c: Country) => void;
}) {
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(term) || c.dial.includes(term) || c.code.toLowerCase().includes(term),
    );
  }, [q]);

  return (
    <ModalShell open={open} onClose={onClose} title="Select country" subtitle={`${COUNTRIES.length} regions`} bodyClassName="max-h-[64vh]">
      <div className="sticky top-0 z-10 -mx-4 mb-2 bg-[#f2f5f9] px-4 pb-1 pt-0.5">
        <div className="neu-sm flex items-center gap-2 rounded-[14px] bg-white px-3 py-2">
          <SearchIcon className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search country or code"
            className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {results.map((c) => {
          const active = c.code === value.code && c.dial === value.dial;
          return (
            <button
              key={`${c.code}-${c.dial}`}
              onClick={() => {
                onSelect(c);
                onClose();
              }}
              className={`flex w-full items-center gap-3 px-1 py-2.5 text-left transition-colors ${active ? "bg-[#eefaf3]" : "active:bg-slate-50"}`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef1f6] text-[18px] leading-none">
                {c.flag}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-extrabold text-slate-900">{c.name}</span>
              <span className="shrink-0 text-[12.5px] font-bold tabular-nums text-slate-500">{c.dial}</span>
              {active && (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <CheckIcon className="h-3.5 w-3.5" />
                </span>
              )}
            </button>
          );
        })}
        {results.length === 0 && (
          <div className="py-8 text-center text-[12.5px] font-semibold text-slate-400">No countries match “{q}”.</div>
        )}
      </div>
    </ModalShell>
  );
}
