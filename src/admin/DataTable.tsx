import type { ReactNode } from "react";
import { useBreakpoint } from "./hooks";
import { Loading } from "./ui";

export interface Column<T> {
  key: string;
  header: string;
  /** cell renderer; default prints row[key] */
  cell?: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  className?: string;
  /** hide on < lg (dense columns) */
  hideOnTablet?: boolean;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  getId: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** which column keys to show on mobile cards (first = title) */
  mobileKeys: string[];
  loading?: boolean;
  sort?: { key: string; dir: "asc" | "desc" };
  onSort?: (key: string) => void;
}

const defaultCell = <T,>(row: T, c: Column<T>) =>
  c.cell ? c.cell(row) : String((row as Record<string, unknown>)[c.key] ?? "—");

/** Responsive list: multi-column table on tablet/desktop, neumorphic cards on phone. */
export function DataTable<T>({ rows, columns, getId, onRowClick, mobileKeys, loading, sort, onSort }: DataTableProps<T>) {
  const bp = useBreakpoint();
  if (loading) return <Loading />;

  /* -------------------------------- mobile cards -------------------------------- */
  if (bp === "mobile") {
    const cols = mobileKeys.map((k) => columns.find((c) => c.key === k)).filter(Boolean) as Column<T>[];
    return (
      <div className="space-y-2.5">
        {rows.map((row) => (
          <button
            key={getId(row)}
            onClick={() => onRowClick?.(row)}
            className="neu flex w-full flex-col gap-1.5 rounded-[16px] bg-white p-3 text-left active:scale-[0.99]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[14px] font-extrabold text-slate-900">{defaultCell(row, cols[0])}</span>
              {cols[1] && <span className="shrink-0">{defaultCell(row, cols[1])}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-semibold text-slate-500">
              {cols.slice(2).map((c) => (
                <span key={c.key} className="tabular-nums">
                  {defaultCell(row, c)}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    );
  }

  /* --------------------------------- full table --------------------------------- */
  return (
    <div className="overflow-x-auto rounded-[16px] bg-white ring-1 ring-slate-100">
      <table className="w-full min-w-[560px] border-collapse text-[13px]">
        <thead>
          <tr className="bg-[#f6f8fb] text-left">
            {columns.map((c) => (
              <th
                key={c.key}
                className={`whitespace-nowrap px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 ${
                  c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""
                } ${c.hideOnTablet && bp === "tablet" ? "hidden lg:table-cell" : ""}`}
              >
                {c.sortable && onSort ? (
                  <button onClick={() => onSort(c.key)} className="inline-flex items-center gap-1 active:opacity-70">
                    {c.header}
                    <span className="text-slate-300">{sort?.key === c.key ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}</span>
                  </button>
                ) : (
                  c.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={getId(row)}
              onClick={() => onRowClick?.(row)}
              className={`border-t border-slate-100 transition-colors ${onRowClick ? "cursor-pointer hover:bg-emerald-50/50" : ""}`}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-3 py-2.5 font-semibold text-slate-700 ${
                    c.align === "right" ? "text-right tabular-nums" : c.align === "center" ? "text-center" : ""
                  } ${c.className ?? ""} ${c.hideOnTablet && bp === "tablet" ? "hidden lg:table-cell" : ""}`}
                >
                  {defaultCell(row, c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
