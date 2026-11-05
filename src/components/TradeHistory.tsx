import { useApp } from "../state/AppStore";
import { ArrowRightIcon, HistoryIcon, TrendArrowIcon } from "./icons";

export function TradeHistory() {
  const { history } = useApp();
  return (
    <section className="neu mx-3 my-1 mb-3 rounded-[20px] bg-white p-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HistoryIcon className="h-4.5 w-4.5 text-slate-900" />
          <h2 className="text-[14px] font-extrabold text-slate-900">Trade History</h2>
        </div>
        <button className="flex items-center gap-1 text-[12px] font-bold text-emerald-500">
          View All
          <ArrowRightIcon className="h-3 w-3" />
        </button>
      </div>

      <div className="mt-1.5 divide-y divide-slate-100">
        {history.map((t) => (
          <div key={t.id} className="flex items-center gap-2 py-1.5 first:pt-1">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${t.positive ? "bg-[#e3f6eb]" : "bg-[#fde4e7]"}`}
            >
              <TrendArrowIcon
                className={`h-3.5 w-3.5 ${t.positive ? "text-emerald-500" : "text-red-500"}`}
                down={!t.positive}
              />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-extrabold text-slate-900">{t.pair}</div>
              <div className="mt-px truncate text-[10.5px] font-medium text-slate-500">
                {t.side} <span className="mx-0.5">•</span> {t.lots}
              </div>
            </div>
            <div
              className={`shrink-0 text-[12.5px] font-extrabold ${t.positive ? "text-emerald-500" : "text-red-500"}`}
            >
              {t.pnl}
            </div>
            <div className="w-[78px] shrink-0 text-right">
              <div className="text-[10px] font-semibold text-slate-500">{t.date}</div>
              <div
                className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[9.5px] font-bold ${
                  t.positive ? "bg-[#e3f6eb] text-emerald-600" : "bg-[#fde4e7] text-red-500"
                }`}
              >
                Closed
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
