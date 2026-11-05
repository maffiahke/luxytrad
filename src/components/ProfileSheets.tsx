import { useState, type ReactNode } from "react";
import {
  BellIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  CrownIcon,
  DocIcon,
  DownloadIcon,
  GlobeIcon,
  HelpIcon,
  InfoIcon,
  LogoutIcon,
  MailIcon,
  PhoneIcon,
  ShieldIcon,
  StarIcon,
  TrendArrowIcon,
  UploadIcon,
  WalletIcon,
} from "./icons";
import { ModalShell, Step, btnContinue, btnSecondary, fieldInput, fieldLabel } from "./Sheet";
import { useApp } from "../state/AppStore";

/* --------------------------------- types ---------------------------------- */

export type ProfileSection =
  | null
  | "history"
  | "settings"
  | "kyc"
  | "notifications"
  | "language"
  | "help"
  | "about"
  | "premium"
  | "logout";

export type KycStatus = "pending" | "review" | "verified";
export type NotifKey = "trades" | "prices" | "funds" | "news" | "promos" | "sms" | "email";

export interface ProfileState {
  profile: { name: string; email: string; phone: string };
  lang: string;
  kyc: KycStatus;
  notif: Record<NotifKey, boolean>;
  security: { twofa: boolean; biometrics: boolean; loginAlerts: boolean };
  premium: boolean;
}

export const initialProfileState: ProfileState = {
  profile: { name: "Grace Wanjiru", email: "grace@example.com", phone: "+254 712 345678" },
  lang: "English",
  kyc: "pending",
  notif: { trades: true, prices: true, funds: true, news: false, promos: false, sms: true, email: true },
  security: { twofa: true, biometrics: true, loginAlerts: false },
  premium: false,
};

type IconCmp = (p: { className?: string }) => ReactNode;

/* -------------------------------- controls -------------------------------- */

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-emerald-600" : "bg-slate-300"}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all duration-200 ${on ? "left-[22px]" : "left-0.5"}`} />
    </button>
  );
}

function Row({
  Icon,
  title,
  sub,
  right,
  onClick,
  tone = "green",
}: {
  Icon: IconCmp;
  title: string;
  sub?: string;
  right?: ReactNode;
  onClick?: () => void;
  tone?: "green" | "red" | "slate" | "amber";
}) {
  const color =
    tone === "red" ? "text-red-500" : tone === "slate" ? "text-slate-500" : tone === "amber" ? "text-[#b98300]" : "text-emerald-600";
  const bg = tone === "red" ? "bg-[#fde4e7]" : tone === "slate" ? "bg-slate-100" : tone === "amber" ? "bg-[#fdf5dd]" : "bg-[#e7f8ef]";
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={`flex w-full items-center gap-2.5 px-2.5 py-2.5 text-left ${onClick ? "active:scale-[0.99]" : ""}`}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bg} ${color}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[12.5px] font-extrabold ${tone === "red" ? "text-red-500" : "text-slate-900"}`}>{title}</span>
        {sub && <span className="block truncate text-[10.5px] font-medium text-slate-500">{sub}</span>}
      </span>
      {right}
    </Tag>
  );
}

const card = "neu rounded-[18px] bg-white p-1.5";
const cardTitle = "px-2 pb-1 pt-1.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-400";
const chevron = <ChevronRightIcon className="h-4 w-4 shrink-0 text-emerald-500" />;
/* --------------------------------- history -------------------------------- */

type HistKind = "deposit" | "withdraw" | "trade" | "other";

const KIND_BY_TYPE: Record<string, HistKind> = {
  DEPOSIT: "deposit",
  BONUS: "deposit",
  WITHDRAWAL: "withdraw",
  TRADE_DEBIT: "trade",
  TRADE_CREDIT: "trade",
};

const kindMeta: Record<HistKind, { Icon: IconCmp; bg: string; color: string }> = {
  deposit: { Icon: DownloadIcon, bg: "bg-[#e7f8ef]", color: "text-emerald-600" },
  withdraw: { Icon: UploadIcon, bg: "bg-[#e8f2fd]", color: "text-sky-600" },
  trade: { Icon: TrendArrowIcon, bg: "bg-[#eef1f6]", color: "text-slate-600" },
  other: { Icon: WalletIcon, bg: "bg-[#eef1f6]", color: "text-slate-600" },
};

const historyFilters = [
  { id: "all", label: "All" },
  { id: "deposit", label: "Deposits" },
  { id: "withdraw", label: "Withdrawals" },
  { id: "trade", label: "Trades" },
] as const;

type HistFilter = (typeof historyFilters)[number]["id"];

const money2 = (n: number) =>
  `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function whenLabel(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const time = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  if (d.toDateString() === now.toDateString()) return `Today, ${time}`;
  const yest = new Date(now.getTime() - 86_400_000);
  if (d.toDateString() === yest.toDateString()) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric"})}, ${time}`;
}

function matchesFilter(kind: HistKind, filter: HistFilter) {
  if (filter === "all") return true;
  if (filter === "deposit") return kind === "deposit";
  if (filter === "withdraw") return kind === "withdraw";
  return kind === "trade";
}

function HistorySheet() {
  const { ledger, settled } = useApp();
  const [filter, setFilter] = useState<HistFilter>("all");

  const rows = ledger.map((l) => ({ l, kind: KIND_BY_TYPE[l.type] ?? ("other" as HistKind) }));
  const list = rows.filter(({ kind }) => matchesFilter(kind, filter));

  const moneyIn = ledger.filter((l) => l.type === "DEPOSIT" || l.type === "BONUS").reduce((s, l) => s + Math.abs(l.amount), 0);
  const moneyOut = ledger.filter((l) => l.type === "WITHDRAWAL").reduce((s, l) => s + Math.abs(l.amount), 0);
  const realized = settled.reduce((s, p) => s + (p.pnl ?? 0), 0);

  return (
    <Step>
      <div className="grid grid-cols-3 gap-2 py-1">
        {[
          { label: "Money in", value: money2(moneyIn), tone: "text-emerald-600" },
          { label: "Money out", value: money2(moneyOut), tone: "text-sky-600" },
          { label: "Realised P&L", value: `${realized >= 0 ? "+" : "-"}${money2(realized)}`, tone: realized >= 0 ? "text-emerald-600" : "text-red-500" },
        ].map((s) => (
          <div key={s.label} className="neu-sm rounded-[14px] bg-white px-2 py-2 text-center">
            <div className="text-[9.5px] font-bold text-slate-400">{s.label}</div>
            <div className={`mt-0.5 text-[12.5px] font-extrabold ${s.tone}`}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-2.5 flex gap-1.5">
        {historyFilters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex-1 rounded-full py-1.5 text-[11px] font-bold transition-all active:scale-95 ${
              filter === f.id ? "bg-emerald-600 text-white shadow-[0_6px_14px_rgba(16,122,74,0.3)]" : "neu-sm bg-white text-slate-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className={`mt-2.5 ${card} divide-y divide-slate-100`}>
        {list.length === 0 && (
          <div className="px-3 py-5 text-center text-[11.5px] font-medium text-slate-400">No transactions in this category yet.</div>
        )}
        {list.map(({ l, kind }) => {
          const { Icon, bg, color } = kindMeta[kind];
          const up = l.amount >= 0;
          return (
            <div key={l.id} className="flex items-center gap-2.5 px-1.5 py-2.5">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${bg} ${color}`}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-extrabold text-slate-900">{l.note || l.type.replace("_", " ")}</div>
                <div className="truncate text-[10px] font-medium text-slate-500">
                  {whenLabel(l.createdAt)} · Bal {money2(l.balanceAfter)}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className={`text-[12.5px] font-extrabold ${up ? "text-emerald-600" : "text-slate-900"}`}>
                  {up ? "+" : "-"}
                  {money2(l.amount)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 px-1 text-center text-[10px] font-medium text-slate-400">
        Every entry is settled by the server. Statements are emailed on the 1st.
      </p>
    </Step>
  );
}
/* --------------------------------- settings -------------------------------- */

function SettingsSheet({ state, patch }: { state: ProfileState; patch: (p: Partial<ProfileState>) => void }) {
  const [draft, setDraft] = useState(state.profile);
  const [saved, setSaved] = useState(false);
  const dirty = draft.name !== state.profile.name || draft.email !== state.profile.email || draft.phone !== state.profile.phone;

  return (
    <Step>
      <div className="neu mt-1 rounded-[18px] bg-white p-3">
        <div className="pb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">Personal details</div>
        <label className={fieldLabel}>Full name</label>
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={fieldInput} />
        <label className={`${fieldLabel} mt-2.5`}>Email address</label>
        <input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} inputMode="email" className={fieldInput} />
        <label className={`${fieldLabel} mt-2.5`}>M-PESA number</label>
        <input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} inputMode="tel" className={fieldInput} />
        <button
          disabled={!dirty}
          onClick={() => {
            patch({ profile: draft });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }}
          className={`${btnContinue} disabled:opacity-40`}
        >
          {saved ? (
            <>
              <CheckIcon className="h-4 w-4" /> Changes saved
            </>
          ) : (
            "Save changes"
          )}
        </button>
      </div>

      <div className={`mt-2.5 ${card} divide-y divide-slate-100`}>
        <div className={cardTitle}>Security</div>
        <Row
          Icon={ShieldIcon}
          title="Two-factor authentication"
          sub={state.security.twofa ? "Authenticator app enabled" : "Add a second sign-in step"}
          right={<Toggle label="Two-factor authentication" on={state.security.twofa} onChange={(v) => patch({ security: { ...state.security, twofa: v } })} />}
        />
        <Row
          Icon={PhoneIcon}
          title="Biometric login"
          sub="Face ID / fingerprint on this device"
          right={<Toggle label="Biometric login" on={state.security.biometrics} onChange={(v) => patch({ security: { ...state.security, biometrics: v } })} />}
        />
        <Row
          Icon={BellIcon}
          title="Login alerts"
          sub={state.security.loginAlerts ? "Email on every new sign-in" : "Currently off"}
          right={<Toggle label="Login alerts" on={state.security.loginAlerts} onChange={(v) => patch({ security: { ...state.security, loginAlerts: v } })} />}
        />
        <Row Icon={ClockIcon} title="Active sessions" sub="2 devices · Nairobi, KE" right={chevron} />
      </div>
    </Step>
  );
}

/* ----------------------------------- kyc ----------------------------------- */

const DOC_TYPES = ["National ID", "Passport", "Driver's licence"] as const;

function KycSheet({ state, patch }: { state: ProfileState; patch: (p: Partial<ProfileState>) => void }) {
  const { trader, submitKyc: serverSubmitKyc } = useApp();
  const [docType, setDocType] = useState<(typeof DOC_TYPES)[number]>("National ID");
  const [front, setFront] = useState(false);
  const [back, setBack] = useState(false);
  const [busy, setBusy] = useState(false);

  const serverStage =
    trader?.kyc === "APPROVED" ? "verified" : trader?.kyc === "UNDER_REVIEW" ? "review" : state.kyc;
  const review = serverStage !== "pending";
  const verified = serverStage === "verified";
  const ready = front && back;

  const steps = [
    { label: "Email verified", ok: true, sub: state.profile.email },
    { label: "Phone verified", ok: true, sub: state.profile.phone },
    { label: "Identity document", ok: verified, sub: verified ? "Approved" : review ? "Under review" : "Required" },
  ];

  return (
    <Step>
      <div
        className={`mt-1 flex items-center gap-2.5 rounded-[18px] p-3 ${
          verified
            ? "bg-[linear-gradient(105deg,#06301f_0%,#0b4d31_60%,#11703f_100%)] text-white"
            : review
              ? "neu bg-white"
              : "bg-[linear-gradient(105deg,#3b2a05_0%,#6b4a06_60%,#8a6108_100%)] text-white"
        }`}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
          {verified ? (
            <CheckIcon className="h-5 w-5 text-emerald-300" />
          ) : review ? (
            <ClockIcon className="h-5 w-5 text-emerald-600" />
          ) : (
            <ShieldIcon className="h-5 w-5 text-[#f7c948]" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className={`text-[13px] font-extrabold ${review && !verified ? "text-slate-900" : ""}`}>
            {verified ? "Identity verified" : review ? "Verification under review" : "Verify your identity"}
          </div>
          <div className={`text-[10.5px] font-medium ${review && !verified ? "text-slate-500" : "text-white/75"}`}>
            {verified
              ? "Withdrawals and bonuses unlocked."
              : review
                ? "Our team reviews documents within 24 hours."
                : "Required before your first withdrawal."}
          </div>
        </div>
      </div>

      <div className={`mt-2.5 ${card} divide-y divide-slate-100`}>
        <div className={cardTitle}>Progress</div>
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2.5 px-2.5 py-2.5">
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold ${
                s.ok ? "bg-emerald-600 text-white" : "bg-[#fdf5dd] text-[#a67c00]"
              }`}
            >
              {s.ok ? <CheckIcon className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-extrabold text-slate-900">{s.label}</span>
              <span className="block truncate text-[10px] font-medium text-slate-500">{s.sub}</span>
            </span>
          </div>
        ))}
      </div>

      {!review && (
        <>
          <div className={`mt-2.5 ${card} divide-y divide-slate-100`}>
            <div className={cardTitle}>Document type</div>
            <div className="flex gap-1.5 p-2">
              {DOC_TYPES.map((d) => (
                <button
                  key={d}
                  onClick={() => setDocType(d)}
                  className={`flex-1 rounded-full py-1.5 text-[10.5px] font-bold transition-all active:scale-95 ${
                    docType === d ? "bg-emerald-600 text-white shadow-[0_6px_14px_rgba(16,122,74,0.3)]" : "neu-sm bg-white text-slate-600"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-2">
            {[
              { label: "Front side", done: front, set: setFront },
              { label: "Back side", done: back, set: setBack },
            ].map((u) => (
              <button
                key={u.label}
                onClick={() => u.set(!u.done)}
                className={`flex flex-col items-center gap-1 rounded-[16px] px-2 py-3 text-center active:scale-[0.98] ${
                  u.done ? "bg-[#e7f8ef] text-emerald-700" : "neu bg-white text-slate-500"
                }`}
              >
                {u.done ? <CheckIcon className="h-5 w-5" /> : <UploadIcon className="h-5 w-5" />}
                <span className="text-[10.5px] font-extrabold">{u.done ? "Uploaded" : u.label}</span>
                <span className="text-[9px] font-medium opacity-70">{u.done ? `${docType}.jpg` : "Tap to attach"}</span>
              </button>
            ))}
          </div>

          <button
            disabled={!ready || busy}
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              const ok = await serverSubmitKyc(docType, state.profile.phone || "KE");
              setBusy(false);
              if (ok) {
                patch({ kyc: "review" });
                setFront(false);
                setBack(false);
              }
            }}
            className={`${btnContinue} disabled:opacity-40`}
          >
            {busy ? "Submitting…" : "Submit for review"}
          </button>
          <p className="mt-1.5 text-center text-[10px] font-medium text-slate-400">
            JPG or PNG under 5 MB. {docType} must match your account name.
          </p>
        </>
      )}
      {review && !verified && (
        <p className="mt-2 px-1 text-center text-[10px] font-medium text-slate-400">
          You'll get a notification once verification is complete. No action needed.
        </p>
      )}
    </Step>
  );
}
/* ------------------------------ notifications ------------------------------ */

const notifGroups: { title: string; items: { key: NotifKey; label: string; sub: string; Icon: IconCmp }[] }[] = [
  {
    title: "Trading",
    items: [
      { key: "trades", label: "Trade alerts", sub: "Fills, margin calls, stop-outs", Icon: TrendArrowIcon },
      { key: "prices", label: "Price alerts", sub: "Levels you set on watchlist pairs", Icon: BellIcon },
    ],
  },
  {
    title: "Money",
    items: [
      { key: "funds", label: "Deposits & withdrawals", sub: "Status changes on every request", Icon: WalletIcon },
      { key: "promos", label: "Promotions & bonuses", sub: "Deposit offers and contests", Icon: CrownIcon },
    ],
  },
  {
    title: "Delivery",
    items: [
      { key: "news", label: "Market news", sub: "Daily digest at 07:00 EAT", Icon: GlobeIcon },
      { key: "email", label: "Email", sub: "Send alerts to your inbox", Icon: MailIcon },
      { key: "sms", label: "SMS", sub: "Critical alerts only, standard rates", Icon: PhoneIcon },
    ],
  },
];

function NotificationsSheet({ state, patch }: { state: ProfileState; patch: (p: Partial<ProfileState>) => void }) {
  const count = Object.values(state.notif).filter(Boolean).length;
  return (
    <Step>
      <div className="neu-sm mb-2.5 flex items-center gap-2.5 rounded-[16px] bg-white px-3 py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e7f8ef] text-emerald-600">
          <BellIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-extrabold text-slate-900">{count} of 7 alerts on</div>
          <div className="text-[10px] font-medium text-slate-500">Critical account alerts can't be disabled.</div>
        </div>
      </div>

      {notifGroups.map((g) => (
        <div key={g.title} className={`mb-2.5 ${card} divide-y divide-slate-100`}>
          <div className={cardTitle}>{g.title}</div>
          {g.items.map((it) => (
            <Row
              key={it.key}
              Icon={it.Icon}
              title={it.label}
              sub={it.sub}
              right={<Toggle label={it.label} on={state.notif[it.key]} onChange={(v) => patch({ notif: { ...state.notif, [it.key]: v } })} />}
            />
          ))}
        </div>
      ))}
    </Step>
  );
}

/* --------------------------------- language -------------------------------- */

const LANGUAGES = [
  { name: "English", native: "English", region: "Default" },
  { name: "Kiswahili", native: "Kiswahili", region: "Kenya" },
  { name: "Français", native: "Français", region: "France" },
  { name: "Español", native: "Español", region: "Spain" },
  { name: "العربية", native: "العربية", region: "Middle East" },
  { name: "中文", native: "中文", region: "China" },
];

function LanguageSheet({ state, patch }: { state: ProfileState; patch: (p: Partial<ProfileState>) => void }) {
  return (
    <Step>
      <div className={`mt-1 ${card} divide-y divide-slate-100`}>
        {LANGUAGES.map((l) => {
          const active = state.lang === l.name;
          return (
            <button
              key={l.name}
              onClick={() => patch({ lang: l.name })}
              className="flex w-full items-center gap-2.5 px-2.5 py-3 text-left active:scale-[0.99]"
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${
                  active ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                {l.native.slice(0, 1)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-extrabold text-slate-900">{l.native}</span>
                <span className="block text-[10px] font-medium text-slate-500">{l.region}</span>
              </span>
              {active ? (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e7f8ef] text-emerald-600">
                  <CheckIcon className="h-3.5 w-3.5" />
                </span>
              ) : (
                <ChevronRightIcon className="h-4 w-4 text-slate-300" />
              )}
            </button>
          );
        })}
      </div>

      <div className={`mt-2.5 ${card} divide-y divide-slate-100`}>
        <div className={cardTitle}>Currency</div>
        <Row Icon={DocIcon} title="Display currency" sub="US Dollar" right={<span className="text-[11.5px] font-extrabold text-emerald-600">USD</span>} />
        <Row
          Icon={PhoneIcon}
          title="M-PESA payout"
          sub="Converted at 129.4 KES / USD"
          right={<span className="text-[11.5px] font-extrabold text-emerald-600">KES</span>}
        />
      </div>
      <p className="mt-2 px-1 text-center text-[10px] font-medium text-slate-400">
        Menus and buttons switch immediately. Statements stay in USD.
      </p>
    </Step>
  );
}
/* ----------------------------------- help ---------------------------------- */

const faqs = [
  {
    q: "How fast is an M-PESA deposit?",
    a: "Most deposits land in under a minute. If you don't see the credit after 5 minutes, send us the M-PESA confirmation code and we'll trace it.",
  },
  {
    q: "When do withdrawals arrive?",
    a: "M-PESA payouts are processed within 30 minutes during business hours. Crypto withdrawals need 2 network confirmations after broadcast.",
  },
  {
    q: "How does the 100% deposit bonus work?",
    a: "Deposits of $100 or more earn a matching bonus on M-PESA. The bonus is credit for trading and is released after you trade 5 standard lots.",
  },
  {
    q: "Why do I need to verify my identity?",
    a: "KYC is required once before your first withdrawal, and keeps your account compliant with Kenyan and international rules.",
  },
  {
    q: "Can I change my phone number?",
    a: "Yes — open Account Settings. Changing the M-PESA number requires a one-time code sent to both the old and new number.",
  },
];

function HelpSheet() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Step>
      <div className="mt-1 grid grid-cols-3 gap-2">
        {[
          { label: "Live chat", sub: "2 min", Icon: HelpIcon, href: "#" },
          { label: "Call us", sub: "Toll free", Icon: PhoneIcon, href: "tel:+254700000000" },
          { label: "Email", sub: "24 h reply", Icon: MailIcon, href: "mailto:support@luxytrades.com" },
        ].map((c) => (
          <a
            key={c.label}
            href={c.href}
            className="neu flex flex-col items-center gap-1 rounded-[16px] bg-white px-1 py-3 text-center text-emerald-600 active:scale-[0.98]"
          >
            <c.Icon className="h-5 w-5" />
            <span className="text-[10.5px] font-extrabold text-slate-900">{c.label}</span>
            <span className="text-[9px] font-medium text-slate-500">{c.sub}</span>
          </a>
        ))}
      </div>

      <div className={`mt-2.5 ${card} divide-y divide-slate-100`}>
        <div className={cardTitle}>Common questions</div>
        {faqs.map((f, i) => (
          <div key={f.q}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center gap-2 px-2.5 py-2.5 text-left"
            >
              <span className="min-w-0 flex-1 text-[12px] font-extrabold text-slate-900">{f.q}</span>
              <ChevronDownIcon className={`h-4 w-4 shrink-0 text-emerald-500 transition-transform ${open === i ? "rotate-180" : ""}`} />
            </button>
            {open === i && <p className="px-2.5 pb-2.5 text-[11px] font-medium leading-relaxed text-slate-500">{f.a}</p>}
          </div>
        ))}
      </div>
      <p className="mt-2 px-1 text-center text-[10px] font-medium text-slate-400">
        Support hours 07:00 – 22:00 EAT, every day.
      </p>
    </Step>
  );
}

/* ---------------------------------- about ---------------------------------- */

function AboutSheet() {
  const [stars, setStars] = useState(0);
  return (
    <Step>
      <div className="neu mt-1 flex flex-col items-center gap-1 rounded-[18px] bg-white px-3 py-4 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-[linear-gradient(140deg,#0b8f52,#064e30)] text-lg font-black text-white shadow-[0_8px_18px_rgba(12,110,66,0.35)]">
          L
        </span>
        <div className="text-[15px] font-extrabold text-slate-900">Luxytrades</div>
        <div className="text-[10.5px] font-medium text-slate-500">Trade smarter. Grow with confidence.</div>
        <span className="mt-1 rounded-full bg-[#e7f8ef] px-2.5 py-1 text-[9.5px] font-extrabold text-emerald-700">Version 1.0.0 (build 124)</span>
      </div>

      <div className={`mt-2.5 ${card} divide-y divide-slate-100`}>
        <div className={cardTitle}>Legal & documents</div>
        {[
          { title: "Terms of Service", sub: "Updated 12 Oct 2026" },
          { title: "Privacy Policy", sub: "How we handle your data" },
          { title: "Risk Disclosure", sub: "Leverage and loss warnings" },
          { title: "Licences", sub: "Registrations and permits" },
        ].map((l) => (
          <Row key={l.title} Icon={DocIcon} title={l.title} sub={l.sub} right={chevron} onClick={() => {}} />
        ))}
      </div>

      <div className="neu mt-2.5 rounded-[18px] bg-white p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[12px] font-extrabold text-slate-900">Enjoying the app?</div>
            <div className="text-[10px] font-medium text-slate-500">A rating helps other traders find us.</div>
          </div>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} aria-label={`Rate ${n} stars`} onClick={() => setStars(n)} className="active:scale-90">
                <StarIcon className={`h-5 w-5 ${n <= stars ? "text-[#f0b429]" : "text-slate-300"}`} filled={n <= stars} />
              </button>
            ))}
          </div>
        </div>
        {stars > 0 && <p className="mt-2 text-[10px] font-bold text-emerald-600">Thanks — your {stars}-star rating was recorded.</p>}
      </div>

      <div className="mt-2.5 flex items-start gap-2 rounded-[16px] bg-[#fdf5dd] px-3 py-2.5 text-[10px] font-medium leading-relaxed text-[#7a5b00]">
        <InfoIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Trading leveraged products carries a high risk of loss. Never invest money you cannot afford to lose.
      </div>
    </Step>
  );
}

/* --------------------------------- premium --------------------------------- */

function PremiumSheet({ state, patch }: { state: ProfileState; patch: (p: Partial<ProfileState>) => void }) {
  const [justUpgraded, setJustUpgraded] = useState(false);
  const features = [
    "Zero spread on EUR/USD, GBP/USD and USD/JPY",
    "Priority M-PESA withdrawals in under 10 minutes",
    "Daily signals from the Luxytrades desk",
    "1-on-1 onboarding call with an analyst",
    "Higher leverage up to 1:400",
  ];

  if (justUpgraded || state.premium) {
    return (
      <Step>
        <div className="mt-1 flex flex-col items-center gap-1.5 rounded-[18px] bg-[linear-gradient(105deg,#06301f_0%,#0b4d31_55%,#127442_100%)] px-4 py-5 text-center text-white">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
            <CrownIcon className="h-6 w-6 text-[#f7c948]" />
          </span>
          <div className="text-[15px] font-extrabold">{justUpgraded ? "Welcome to Premium" : "Premium Trader"}</div>
          <div className="text-[10.5px] font-medium text-white/70">
            {justUpgraded ? "Your perks are active right now." : "Your plan renews on 3 Dec 2026."}
          </div>
        </div>
        <div className={`mt-2.5 ${card} divide-y divide-slate-100`}>
          <div className={cardTitle}>Included</div>
          {features.map((f) => (
            <div key={f} className="flex items-start gap-2 px-2.5 py-2">
              <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span className="text-[11px] font-medium text-slate-600">{f}</span>
            </div>
          ))}
        </div>
        {justUpgraded ? (
          <button onClick={() => setJustUpgraded(false)} className={btnContinue}>
            Done
          </button>
        ) : (
          <button
            onClick={() => {
              patch({ premium: false });
              setJustUpgraded(false);
            }}
            className={btnSecondary}
          >
            Cancel membership
          </button>
        )}
      </Step>
    );
  }

  return (
    <Step>
      <div className="mt-1 rounded-[18px] bg-[linear-gradient(105deg,#3b2a05_0%,#6b4a06_55%,#a97a0b_100%)] px-4 py-4 text-white">
        <div className="flex items-center gap-2">
          <CrownIcon className="h-5 w-5 text-[#f7c948]" />
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#f7c948]">Premium</span>
        </div>
        <div className="mt-1 text-[18px] font-extrabold">Trade like a pro</div>
        <p className="mt-0.5 text-[10.5px] font-medium leading-relaxed text-white/70">
          Tighter spreads, faster payouts and direct access to our analysts.
        </p>
        <div className="mt-2.5 flex items-end gap-1">
          <span className="text-[24px] font-black leading-none">$9.99</span>
          <span className="pb-0.5 text-[11px] font-bold text-white/60">/ month</span>
        </div>
      </div>

      <div className={`mt-2.5 ${card} divide-y divide-slate-100`}>
        {features.map((f) => (
          <div key={f} className="flex items-start gap-2 px-2.5 py-2">
            <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span className="text-[11px] font-medium text-slate-600">{f}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => {
          patch({ premium: true });
          setJustUpgraded(true);
        }}
        className={btnContinue}
      >
        <CrownIcon className="h-4 w-4" /> Upgrade for $9.99 / month
      </button>
      <button className={btnSecondary} onClick={() => {}}>
        Maybe later
      </button>
      <p className="mt-1.5 text-center text-[9.5px] font-medium text-slate-400">Cancel anytime from this screen. Billed monthly.</p>
    </Step>
  );
}

/* ---------------------------------- logout --------------------------------- */

function LogoutSheet({ onLogout }: { onLogout: () => void }) {
  return (
    <Step>
      <div className="mt-1 flex flex-col items-center gap-1.5 rounded-[18px] bg-white px-4 py-5 text-center neu">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fde4e7] text-red-500">
          <LogoutIcon className="h-6 w-6" />
        </span>
        <div className="text-[14px] font-extrabold text-slate-900">Log out of Luxytrades?</div>
        <p className="text-[10.5px] font-medium leading-relaxed text-slate-500">
          You'll need your email and password to sign back in. Open positions stay active on your account.
        </p>
      </div>
      <button onClick={onLogout} className="mt-3 flex w-full items-center justify-center gap-2 rounded-[16px] bg-red-500 py-3 text-[13.5px] font-extrabold text-white shadow-[0_8px_18px_rgba(220,60,60,0.3)] active:scale-[0.98]">
        <LogoutIcon className="h-4 w-4" /> Log out
      </button>
      <p className="mt-2 text-center text-[10px] font-medium text-slate-400">Tip: enable biometric login first for a faster sign-in.</p>
    </Step>
  );
}

/* -------------------------------- dispatcher -------------------------------- */

const sectionMeta: Record<Exclude<ProfileSection, null>, { title: string; subtitle: string }> = {
  history: { title: "Transaction History", subtitle: "Deposits, withdrawals and trades" },
  settings: { title: "Account Settings", subtitle: "Personal details and security" },
  kyc: { title: "Verification", subtitle: "Identity and account limits" },
  notifications: { title: "Notifications", subtitle: "Choose what reaches you" },
  language: { title: "Language", subtitle: "App language and currencies" },
  help: { title: "Help & Support", subtitle: "We're here 07:00 – 22:00 EAT" },
  about: { title: "About Luxytrades", subtitle: "Version and legal" },
  premium: { title: "Premium Trader", subtitle: "Unlock pro trading tools" },
  logout: { title: "Log out", subtitle: "End this session" },
};

export function ProfileSheets({
  section,
  onClose,
  state,
  patch,
  onLogout,
}: {
  section: ProfileSection;
  onClose: () => void;
  state: ProfileState;
  patch: (p: Partial<ProfileState>) => void;
  onLogout: () => void;
}) {
  const [last, setLast] = useState<Exclude<ProfileSection, null>>("settings");
  if (section && section !== last) setLast(section);
  const key = section ?? last;
  const meta = sectionMeta[key];

  return (
    <ModalShell open={section !== null} onClose={onClose} title={meta.title} subtitle={meta.subtitle} bodyClassName="max-h-[68vh]">
      {key === "history" && <HistorySheet />}
      {key === "settings" && <SettingsSheet state={state} patch={patch} />}
      {key === "kyc" && <KycSheet state={state} patch={patch} />}
      {key === "notifications" && <NotificationsSheet state={state} patch={patch} />}
      {key === "language" && <LanguageSheet state={state} patch={patch} />}
      {key === "help" && <HelpSheet />}
      {key === "about" && <AboutSheet />}
      {key === "premium" && <PremiumSheet state={state} patch={patch} />}
      {key === "logout" && <LogoutSheet onLogout={onLogout} />}
    </ModalShell>
  );
}
