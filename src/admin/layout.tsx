import { useState, type ReactNode } from "react";
import { useIsCompact } from "./hooks";
import { useAdmin } from "./AdminStore";
import type { AdminRole } from "./types";
import {
  AtIcon,
  BellIcon,
  ChartLogo,
  ClockIcon,
  DocIcon,
  DownloadIcon,
  GearIcon,
  GlobeIcon,
  HistoryIcon,
  HomeIcon,
  LockIcon,
  LogoutIcon,
  MailIcon,
  MarketsIcon,
  Robot,
  SearchIcon,
  ShieldIcon,
  TargetIcon,
  UploadIcon,
  UserIcon,
  WalletIcon,
} from "../components/icons";

export type RouteId =
  | "dashboard"
  | "users"
  | "kyc"
  | "deposits"
  | "withdrawals"
  | "ledger"
  | "positions"
  | "runs"
  | "bots"
  | "markets"
  | "gateways"
  | "callbacks"
  | "reconciliation"
  | "support"
  | "emails"
  | "reports"
  | "settings"
  | "staff"
  | "roles"
  | "audit";

interface NavItem {
  id: RouteId;
  label: string;
  icon: ReactNode;
  badge?: (role: AdminRole) => boolean; // show for role
}
interface NavGroup {
  title: string;
  items: NavItem[];
}

const ic = (C: (p: { className?: string }) => ReactNode, cls = "h-[18px] w-[18px]") => C({ className: cls });

export const NAV: NavGroup[] = [
  { title: "", items: [{ id: "dashboard", label: "Overview", icon: ic(HomeIcon) }] },
  {
    title: "People",
    items: [
      { id: "users", label: "Users", icon: ic(UserIcon) },
      { id: "kyc", label: "KYC Queue", icon: ic(ShieldIcon) },
    ],
  },
  {
    title: "Money",
    items: [
      { id: "deposits", label: "Deposits", icon: ic(DownloadIcon) },
      { id: "withdrawals", label: "Withdrawals", icon: ic(UploadIcon) },
      { id: "ledger", label: "Ledger", icon: ic(HistoryIcon) },
    ],
  },
  {
    title: "Trading",
    items: [
      { id: "positions", label: "Positions", icon: ic(TargetIcon) },
      { id: "runs", label: "Runs", icon: ic(ClockIcon) },
      { id: "bots", label: "Trading Bots", icon: ic(Robot) },
      { id: "markets", label: "Markets & Payouts", icon: ic(MarketsIcon) },
    ],
  },
  {
    title: "Payments",
    items: [
      { id: "gateways", label: "Gateways", icon: ic(WalletIcon) },
      { id: "callbacks", label: "Callbacks", icon: ic(BellIcon) },
      { id: "reconciliation", label: "Reconciliation", icon: ic(GlobeIcon) },
    ],
  },
  { title: "Insights", items: [{ id: "reports", label: "Reports", icon: ic(ChartLogo) }] },
  { title: "Support", items: [{ id: "support", label: "Tickets", icon: ic(MailIcon) }] },
  { title: "Messaging", items: [{ id: "emails", label: "Emails", icon: ic(AtIcon) }] },
  {
    title: "Administration",
    items: [
      { id: "settings", label: "Settings", icon: ic(GearIcon) },
      { id: "staff", label: "Staff", icon: ic(AtIcon) },
      { id: "roles", label: "Roles", icon: ic(LockIcon) },
      { id: "audit", label: "Audit Log", icon: ic(DocIcon) },
    ],
  },
];

const LABEL: Record<RouteId, string> = Object.fromEntries(
  NAV.flatMap((g) => g.items).map((i) => [i.id, i.label]),
) as Record<RouteId, string>;

const BOTTOM_TABS: { id: RouteId; label: string; icon: ReactNode }[] = [
  { id: "dashboard", label: "Overview", icon: ic(HomeIcon, "h-5 w-5") },
  { id: "deposits", label: "Money", icon: ic(WalletIcon, "h-5 w-5") },
  { id: "positions", label: "Trading", icon: ic(TargetIcon, "h-5 w-5") },
  { id: "support", label: "Support", icon: ic(MailIcon, "h-5 w-5") },
];

function NavButton({ item, active, onGo }: { item: NavItem; active: boolean; onGo: (id: RouteId) => void }) {
  return (
    <button
      onClick={() => onGo(item.id)}
      className={`group flex w-full items-center gap-3 rounded-[12px] px-3 py-2 text-left text-[13px] font-extrabold transition-all active:scale-[0.98] ${
        active ? "bg-[linear-gradient(160deg,#10b981,#047857)] text-white shadow-[0_6px_14px_rgba(16,122,74,0.3)]" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      <span className={active ? "text-white" : "text-emerald-600"}>{item.icon}</span>
      <span className="truncate">{item.label}</span>
    </button>
  );
}

function NavGroups({ route, onGo }: { route: RouteId; onGo: (id: RouteId) => void }) {
  return (
    <nav className="flex flex-col gap-3">
      {NAV.map((g, i) => (
        <div key={i}>
          {g.title && <div className="mb-1 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">{g.title}</div>}
          <div className="space-y-0.5">
            {g.items.map((it) => (
              <NavButton key={it.id} item={it} active={route === it.id} onGo={onGo} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

/** persistent rail on desktop, slide-over drawer on compact — same content */
export function AdminShell({ route, onGo, children }: { route: RouteId; onGo: (id: RouteId) => void; children: ReactNode }) {
  const { session, signOut } = useAdmin();
  const isCompact = useIsCompact();
  const [drawer, setDrawer] = useState(false);
  const go = (id: RouteId) => {
    onGo(id);
    setDrawer(false);
  };

  return (
    <div className="min-h-dvh bg-[#eef1f6] text-slate-900">
      {/* desktop rail */}
      {!isCompact && (
        <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-slate-200 bg-white p-3 xl:w-64">
          <div className="mb-3 flex items-center gap-2 px-1">
            <div className="grid h-9 w-9 place-items-center rounded-[12px] bg-[linear-gradient(160deg,#1fc47d,#0b8a4c)] text-white shadow-[0_6px_12px_rgba(11,138,76,0.3)]">
              <ChartLogo className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-[14px] font-extrabold">Luxytrades</div>
              <div className="text-[10.5px] font-bold uppercase tracking-widest text-emerald-600">Admin</div>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <NavGroups route={route} onGo={go} />
          </div>
          <button onClick={signOut} className="mt-2 flex items-center gap-3 rounded-[12px] px-3 py-2 text-[13px] font-extrabold text-slate-500 hover:bg-rose-50 hover:text-rose-600">
            <LogoutIcon className="h-[18px] w-[18px]" /> Sign out
          </button>
        </aside>
      )}

      {/* mobile drawer */}
      {isCompact && drawer && (
        <div className="fixed inset-0 z-50">
          <button aria-label="Close menu" className="absolute inset-0 bg-slate-900/45" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-white p-3 shadow-2xl anim-slide-in">
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="grid h-9 w-9 place-items-center rounded-[12px] bg-[linear-gradient(160deg,#1fc47d,#0b8a4c)] text-white">
                  <ChartLogo className="h-5 w-5" />
                </div>
                <div className="text-[14px] font-extrabold">Luxytrades Admin</div>
              </div>
              <button onClick={() => setDrawer(false)} aria-label="Close" className="text-[20px] font-extrabold text-slate-400">×</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <NavGroups route={route} onGo={go} />
            </div>
            <button onClick={signOut} className="mt-2 flex items-center gap-3 rounded-[12px] px-3 py-2 text-[13px] font-extrabold text-rose-600 hover:bg-rose-50">
              <LogoutIcon className="h-[18px] w-[18px]" /> Sign out
            </button>
          </div>
        </div>
      )}

      {/* main column */}
      <div className={isCompact ? "" : "lg:pl-60 xl:pl-64"}>
        {/* topbar */}
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-[#eef1f6]/85 px-3 py-2.5 backdrop-blur sm:px-4">
          {isCompact && (
            <button onClick={() => setDrawer(true)} aria-label="Open menu" className="neu-sm flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-white text-slate-600 active:scale-95">
              <MenuGlyph />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-extrabold text-slate-900">{LABEL[route]}</div>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <SearchIcon className="h-4 w-4 text-slate-400" />
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">Search</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-extrabold uppercase text-emerald-600 ring-1 ring-emerald-100">
              {session?.role === "READONLY" ? "Demo" : "Live"}
            </span>
            <div className="hidden text-right sm:block">
              <div className="text-[12px] font-extrabold leading-none text-slate-800">{session?.name}</div>
              <div className="text-[10px] font-bold uppercase text-slate-400">{session?.role.replace("_", " ")}</div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1400px] px-3 py-4 pb-24 sm:px-4 lg:pb-6">{children}</main>
      </div>

      {/* mobile bottom tabs */}
      {isCompact && (
        <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-[560px] items-stretch justify-around border-t border-slate-200 bg-white/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          {BOTTOM_TABS.map((t) => {
            const active = t.id === route;
            return (
              <button key={t.id} onClick={() => go(t.id)} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-extrabold ${active ? "text-emerald-600" : "text-slate-400"}`}>
                {t.icon}
                {t.label}
              </button>
            );
          })}
          <button onClick={() => setDrawer(true)} className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-extrabold text-slate-400">
            <span className="text-[18px] leading-none">•••</span>More
          </button>
        </nav>
      )}
    </div>
  );
}

function MenuGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
