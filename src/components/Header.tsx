import { useState } from "react";
import { useApp, ACCOUNTS, type AccountType } from "../state/AppStore";
import { AvatarBadge, ChartLogo, ChevronDownIcon, UsaFlagIcon, CheckIcon } from "./icons";

const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const DOT: Record<AccountType, string> = { real: "bg-emerald-500", demo: "bg-amber-400" };

function Avatar() {
  return (
    <div className="relative">
      <div className="h-9 w-9 overflow-hidden rounded-full bg-gradient-to-b from-sky-300 to-emerald-600 ring-2 ring-white shadow-sm">
        <svg viewBox="0 0 44 44" className="h-full w-full" aria-label="Account avatar">
          <circle cx="22" cy="17" r="8.4" fill="#7a4a21" />
          <circle cx="19.8" cy="20" r="6.6" fill="#c98d5a" />
          <path d="M13.6 17.8c1-7.4 15.8-7.4 16.8-.2l-1.4.2c-2.8-1-5-1.6-7-1.6s-4.2.6-7 1.6l-1.4 0Z" fill="#241a12" />
          <path d="M22 30.5c-7.4.5-10.4 4.6-10.4 13.5h20.8c0-8.9-3-13-10.4-13.5Z" fill="#1f3a63" />
          <path d="M19.6 20.6a1.4 1.4 0 1 1 1.4 1.7 1.7 1.7 0 0 0 .3 1 3 3 0 0 1 .9-1.2l.3.4a2.3 2.3 0 0 1 .6 3.7 2.6 2.6 0 0 0 2.4-2.5c0-.4-.1-.8-.3-1.2l.4-.6a1.5 1.5 0 0 0-1.4-.9 2 2 0 0 0-1.7.9l-.4-1.2Z" fill="#c98d5a" />
          <path d="M17.2 30.6h9.6c1 2.3 4.7 4.5 4.7 13.4h-19c0-8.9 3.7-11.1 4.7-13.4Z" fill="#3c70c9" />
        </svg>
      </div>
      <AvatarBadge className="absolute -bottom-0.5 -right-1 h-4 w-4 drop-shadow" />
    </div>
  );
}

export function Header() {
  const { balance, accounts, activeAccount, switchAccount } = useApp();
  const [open, setOpen] = useState(false);
  const active = ACCOUNTS.find((a) => a.id === activeAccount)!;

  const pick = (id: AccountType) => {
    switchAccount(id);
    setOpen(false);
  };

  return (
    <div className="flex items-center justify-between px-3.5 pt-3 pb-1">
      <div className="flex min-w-0 items-center gap-1.5">
        <ChartLogo className="h-7 w-8 shrink-0" />
        <div className="min-w-0">
          <h1 className="truncate text-[15px] font-extrabold leading-none tracking-tight text-slate-900">
            Luxytrades
          </h1>
          <p className="mt-0.5 truncate text-[9px] font-medium leading-none text-emerald-600/90">
            Trade Smarter. Grow with Confidence.
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={open}
            className="flex w-[150px] items-center gap-1.5 rounded-2xl border border-slate-100 bg-white px-2.5 py-1.5 shadow-sm active:scale-[0.98] transition-transform"
          >
            <UsaFlagIcon className="h-5 w-5 shrink-0" />
            <div className="min-w-0 text-left">
              <div className="flex items-center gap-1 text-[10px] leading-none text-slate-500">
                <span className={`h-1.5 w-1.5 rounded-full ${DOT[active.id]}`} />
                {active.tag} balance
              </div>
              <div className="mt-0.5 flex items-center gap-1">
                <span className="truncate text-[12px] font-extrabold leading-none text-slate-900">{fmt(balance)}</span>
                <ChevronDownIcon className={`h-3 w-3 shrink-0 text-slate-500 transition-transform ${open ? "rotate-180" : ""}`} />
              </div>
            </div>
          </button>

          {open && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} aria-hidden />
              <div
                role="menu"
                className="absolute right-0 z-30 mt-1.5 w-[228px] overflow-hidden rounded-[18px] border border-slate-100 bg-white p-1.5 shadow-[0_18px_40px_rgba(15,40,30,0.18)]"
              >
                <div className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Switch account
                </div>
                {ACCOUNTS.map((a) => {
                  const isActive = a.id === activeAccount;
                  return (
                    <button
                      key={a.id}
                      role="menuitem"
                      onClick={() => pick(a.id)}
                      aria-pressed={isActive}
                      className={`flex w-full items-center gap-2.5 rounded-[13px] px-2 py-2 text-left transition-colors ${
                        isActive ? "bg-[#eefaf3]" : "hover:bg-slate-50"
                      }`}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef1f6]">
                        <span className={`h-2.5 w-2.5 rounded-full ${DOT[a.id]}`} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[12.5px] font-extrabold text-slate-900">{a.label}</span>
                          {a.id === "demo" && (
                            <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[8.5px] font-extrabold uppercase tracking-wide text-amber-600">
                              Practice
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] font-bold text-slate-500">{fmt(accounts[a.id])}</div>
                      </div>
                      {isActive && (
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                          <CheckIcon className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
                <div className="mt-1 px-2 pb-1 pt-1 text-[10px] font-medium leading-snug text-slate-400">
                  Demo trades use virtual funds — no real money at risk.
                </div>
              </div>
            </>
          )}
        </div>
        <Avatar />
      </div>
    </div>
  );
}
