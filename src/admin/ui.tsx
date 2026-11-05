import type { ReactNode } from "react";
import { SearchIcon } from "../components/icons";

export const money = (n: number, digits = 2) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export const num = (n: number) => n.toLocaleString("en-US");

export const shortDate = (iso: string) => {
  const d = new Date(iso);
  const sameDay = new Date().toDateString() === d.toDateString();
  const t = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `Today ${t}` : `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} ${t}`;
};

export type Tone = "green" | "red" | "amber" | "slate" | "blue" | "violet";

const toneMap: Record<Tone, string> = {
  green: "bg-[#e7f8ef] text-emerald-700 ring-emerald-200",
  red: "bg-[#fdeaec] text-rose-600 ring-rose-200",
  amber: "bg-[#fdf5dd] text-amber-700 ring-amber-200",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
  blue: "bg-[#e8f0fe] text-sky-700 ring-sky-200",
  violet: "bg-[#efeafe] text-violet-700 ring-violet-200",
};

export const statusTone = (s: string): Tone => {
  switch (s) {
    case "ACTIVE":
    case "APPROVED":
    case "COMPLETED":
    case "WON":
    case "RESOLVED":
    case "CLOSED":
    case "verified":
      return "green";
    case "REJECTED":
    case "LOST":
    case "FAILED":
    case "BANNED":
      return "red";
    case "PENDING":
    case "ACTION_REQUIRED":
    case "UNDER_REVIEW":
    case "SUSPENDED":
    case "OPEN":
    case "HIGH":
    case "URGENT":
      return "amber";
    case "ON":
      return "green";
    case "OFF":
      return "slate";
    default:
      return "slate";
  }
};

export function Badge({ label, tone }: { label: string; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide ring-1 ${
        toneMap[tone ?? statusTone(label)]
      }`}
    >
      {label.replace(/_/g, " ")}
    </span>
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone = "green",
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  icon?: ReactNode;
}) {
  return (
    <div className="neu rounded-[18px] bg-white p-3.5 sm:p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
        {icon && <span className={`grid h-7 w-7 place-items-center rounded-[10px] ring-1 ${toneMap[tone]}`}>{icon}</span>}
      </div>
      <div className="mt-1.5 text-[22px] font-extrabold leading-none tabular-nums text-slate-900">{value}</div>
      {sub && <div className="mt-1 text-[11.5px] font-semibold text-slate-400">{sub}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 className="text-[19px] font-extrabold leading-tight text-slate-900">{title}</h1>
        {subtitle && <p className="text-[12px] font-medium text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-500" />;
}

export function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-[13px] font-bold text-slate-400">
      <Spinner /> Loading…
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="grid place-items-center rounded-[16px] bg-white py-12 text-center ring-1 ring-slate-100">
      <div className="text-[14px] font-extrabold text-slate-700">{title}</div>
      {hint && <div className="mt-1 text-[12px] font-medium text-slate-400">{hint}</div>}
    </div>
  );
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="neu-sm flex min-w-0 flex-1 items-center gap-2 rounded-[12px] bg-white px-3 py-2">
      <SearchIcon className="h-4 w-4 shrink-0 text-slate-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Search…"}
        className="min-w-0 flex-1 bg-transparent text-[13px] font-bold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400"
      />
      {value && (
        <button onClick={() => onChange("")} aria-label="Clear search" className="text-[16px] font-extrabold leading-none text-slate-400">
          ×
        </button>
      )}
    </label>
  );
}

/** a horizontal row of pill filters; wraps on mobile */
export function StatusPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`rounded-full px-3 py-1 text-[12px] font-extrabold transition-all active:scale-95 ${
              active
                ? "bg-[linear-gradient(160deg,#10b981,#047857)] text-white shadow-[0_6px_12px_rgba(16,122,74,0.3)]"
                : "neu-sm bg-white text-slate-600"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function KebabMenu({ items }: { items: { label: string; onClick: () => void; danger?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <button
          key={it.label}
          onClick={it.onClick}
          className={`rounded-[10px] px-2.5 py-1 text-[11.5px] font-extrabold active:scale-95 ${
            it.danger ? "bg-[#fdeaec] text-rose-600" : "neu-sm bg-white text-emerald-700"
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
