import { useState } from "react";
import { useApp } from "../state/AppStore";
import { FundsModals, type FundMode } from "./FundsModals";
import {
  AvatarBadge,
  BellIcon,
  ChevronRightIcon,
  CrownIcon,
  DocIcon,
  GearIcon,
  GlobeIcon,
  HelpIcon,
  InfoIcon,
  LogoutIcon,
  MailIcon,
  PhoneIcon,
  ShieldIcon,
} from "./icons";
import { ProfileSheets, type ProfileSection, type ProfileState } from "./ProfileSheets";

const PF_CSS = `
.lxpf-icon{transform-origin:center;will-change:transform;display:inline-flex;}
.lxpf-bob{animation:lxpf-bob 2.6s ease-in-out infinite;}
.lxpf-swing{animation:lxpf-swing 2.4s ease-in-out infinite;}
.lxpf-spin{animation:lxpf-spin 7s linear infinite;}
.lxpf-pulse{animation:lxpf-pulse 2.2s ease-in-out infinite;}
.lxpf-wiggle{animation:lxpf-wiggle 3s ease-in-out infinite;}
.lxpf-twinkle{animation:lxpf-twinkle 2s ease-in-out infinite;}
.lxpf-pop{animation:lxpf-pop 2.4s ease-in-out infinite;}
@keyframes lxpf-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5px)}}
@keyframes lxpf-swing{0%,100%{transform:rotate(0)}18%{transform:rotate(-13deg)}36%{transform:rotate(11deg)}54%{transform:rotate(-7deg)}72%{transform:rotate(4deg)}}
@keyframes lxpf-spin{to{transform:rotate(360deg)}}
@keyframes lxpf-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.16)}}
@keyframes lxpf-wiggle{0%,100%{transform:rotate(0)}25%{transform:rotate(-9deg)}75%{transform:rotate(9deg)}}
@keyframes lxpf-twinkle{0%,100%{transform:scale(1) rotate(0)}50%{transform:scale(1.22) rotate(-11deg)}}
@keyframes lxpf-pop{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}
.lxpf-badge{position:relative;}
.lxpf-badge::after{content:"";position:absolute;inset:0;border-radius:9999px;animation:lxpf-halo 2.8s ease-out infinite;}
@keyframes lxpf-halo{0%{box-shadow:0 0 0 0 rgba(16,185,129,0.35)}70%{box-shadow:0 0 0 8px rgba(16,185,129,0)}100%{box-shadow:0 0 0 0 rgba(16,185,129,0)}}
.lxpf-chevron{transition:transform 0.2s ease;}
.lxpf-row:hover .lxpf-chevron{transform:translateX(3px);}
@media (prefers-reduced-motion: reduce){.lxpf-icon,.lxpf-badge::after{animation:none !important;}}
`;

function BigAvatar() {
  return (
    <div className="relative shrink-0">
      <div className="h-14 w-14 overflow-hidden rounded-full bg-gradient-to-b from-sky-300 to-emerald-600 ring-2 ring-white shadow-sm">
        <svg viewBox="0 0 44 44" className="h-full w-full" aria-label="John Mwangi">
          <circle cx="22" cy="17" r="8.4" fill="#7a4a21" />
          <circle cx="20" cy="18" r="7" fill="#c98d5a" />
          <path d="M13.6 17.8c1-7.6 15.8-7.6 16.8-.2l-1.5.2c-2.7-1-5-1.6-6.9-1.6s-4.2.6-6.9 1.6l-1.5 0Z" fill="#241a12" />
          <circle cx="17.4" cy="17.5" r="0.6" fill="#241a12" />
          <circle cx="22.6" cy="17.5" r="0.6" fill="#241a12" />
          <path d="M20.2 20.4q1.8 1.4 3.6 0" stroke="#241a12" strokeWidth="0.7" strokeLinecap="round" fill="none" />
          <path d="M22 30.5c-7.4.5-10.4 4.6-10.4 13.5h20.8c0-8.9-3-13-10.4-13.5Z" fill="#3c70c9" />
          <path d="M17.2 30.8h9.6c1 2.3 3.4 3.4 3.4 6.4-2.6 1.4-10.6 1.3-13.4 0 0-3 1.4-4.1 3.4-6.4Z" fill="#f7f9fb" />
        </svg>
      </div>
      <AvatarBadge className="lxpf-icon lxpf-pop absolute -bottom-0.5 -right-1 h-5 w-5 drop-shadow" />
    </div>
  );
}

export function ProfileScreen({ state, patch }: { state: ProfileState; patch: (p: Partial<ProfileState>) => void }) {
  const { trader, logout } = useApp();
  const [fundMode, setFundMode] = useState<FundMode>(null);
  const [section, setSection] = useState<ProfileSection>(null);

  const name = trader?.fullName?.trim() || "Luxytrades Trader";
  const email = trader?.email?.trim() || "No email on file";
  const phone = trader?.phone ? `+${trader.phone}` : "No phone on file";
  const stage =
    trader?.kyc === "APPROVED" ? "verified" : trader?.kyc === "UNDER_REVIEW" ? "review" : state.kyc;

  const menu = [
    { Icon: DocIcon, anim: "lxpf-bob", title: "Transaction History", sub: "View all transactions", section: "history" as const },
    { Icon: GearIcon, anim: "lxpf-spin", title: "Account Settings", sub: "Security & Preferences", section: "settings" as const },
    {
      Icon: ShieldIcon,
      anim: "lxpf-pulse",
      title: "KYC Verification",
      sub: stage === "verified" ? "Identity verified" : stage === "review" ? "Under review · 24h" : "Verify your identity",
      section: "kyc" as const,
    },
    { Icon: BellIcon, anim: "lxpf-swing", title: "Notifications", sub: "Manage alerts", section: "notifications" as const },
    { Icon: GlobeIcon, anim: "lxpf-spin", title: "Language", sub: state.lang, section: "language" as const },
    { Icon: HelpIcon, anim: "lxpf-bob", title: "Help & Support", sub: "Get help from our team", section: "help" as const },
    { Icon: InfoIcon, anim: "lxpf-pulse", title: "About Luxytrades", sub: "App version 1.0.0", section: "about" as const },
  ];

  return (
    <div className="px-3 pb-3">
      <style>{PF_CSS}</style>
      {/* identity card */}
      <section className="neu mt-2 rounded-[20px] bg-white p-3">
        <div className="flex items-center gap-3">
          <BigAvatar />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[16px] font-extrabold leading-tight text-slate-900">{name}</h2>
            <span
              className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                stage === "verified" ? "bg-emerald-100 text-emerald-600" : "bg-[#fdf5dd] text-[#a67c00]"
              }`}
            >
              {stage === "verified" ? "✓ Verified" : stage === "review" ? "⏳ Under review" : "! Unverified"}
            </span>
          </div>
          <button
            onClick={() => setSection("settings")}
            className="neu-sm shrink-0 self-start rounded-full bg-white px-2.5 py-1 text-[10.5px] font-bold text-slate-600 active:scale-95"
          >
            Edit
          </button>
        </div>

        <div className="mt-3 space-y-1.5 rounded-[14px] bg-[#f4f7fb] px-2.5 py-2">
          <div className="flex items-center gap-2">
            <MailIcon className="lxpf-icon lxpf-bob h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-slate-600">{email}</span>
          </div>
          <div className="flex items-center gap-2">
            <PhoneIcon className="lxpf-icon lxpf-wiggle h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-slate-600">{phone}</span>
          </div>
        </div>
      </section>

      {/* premium trader */}
      <section
        className="mt-2.5 flex items-center gap-2.5 rounded-[20px] bg-[linear-gradient(105deg,#06301f_0%,#0b4d31_60%,#11703f_100%)] p-3"
        style={{ boxShadow: "6px 6px 16px rgba(6,48,31,0.35), -4px -4px 10px rgba(255,255,255,0.55)" }}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
          <CrownIcon className="lxpf-icon lxpf-twinkle h-5 w-5 text-[#f7c948]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-extrabold leading-tight text-white">{state.premium ? "Premium active" : "Premium Trader"}</div>
          <div className="text-[10.5px] font-medium text-emerald-100/90">
            {state.premium ? "Spreads and payouts upgraded" : "Unlock more features"}
          </div>
        </div>
        <button
          onClick={() => setSection("premium")}
          className="shrink-0 rounded-full bg-[linear-gradient(#fcd34d,#f0b429)] px-3.5 py-1.5 text-[11.5px] font-extrabold text-[#3f2d05] shadow-[0_6px_14px_rgba(0,0,0,0.35)] active:scale-95"
        >
          {state.premium ? "Manage" : "Upgrade"}
        </button>
      </section>

      {/* deposit / withdraw buttons */}
      <section className="neu mt-2 rounded-[20px] bg-white p-3" style={{ boxShadow: "3px 3px 10px rgba(166,180,200,0.3), -3px -3px 10px rgba(255,255,255,0.9)" }}>
        <div className="flex gap-3">
          <button onClick={() => setFundMode("deposit")} className="neu flex-1 rounded-[16px] bg-emerald-600 py-3 text-[13px] font-extrabold text-white shadow-[0_8px_18px_rgba(16,122,74,0.35)] active:scale-[0.97]">
            Deposit
          </button>
          <button onClick={() => setFundMode("withdraw")} className="neu flex-1 rounded-[16px] bg-white py-3 text-[13px] font-bold text-slate-600 shadow-[3px_3px_9px_rgba(166,180,200,0.45),-3px_-3px_9px_rgba(255,255,255,0.95)] active:scale-[0.97]">
            Withdraw
          </button>
        </div>
      </section>

      {/* menu list */}
      <section className="neu mt-2.5 divide-y divide-slate-100 rounded-[20px] bg-white px-1 py-0.5">
        {menu.map(({ Icon, anim, title, sub, section: target }, i) => (
          <button key={title} onClick={() => setSection(target)} className="lxpf-row flex w-full items-center gap-2.5 px-2.5 py-2.5 text-left active:scale-[0.99]">
            <span className="lxpf-badge flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e7f8ef] text-emerald-600">
              <span className={`lxpf-icon ${anim}`} style={{ animationDelay: `${i * 0.18}s` }}>
                <Icon className="h-4 w-4" />
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-extrabold text-slate-900">{title}</span>
              <span className="block truncate text-[10.5px] font-medium text-slate-500">{sub}</span>
            </span>
            <ChevronRightIcon className="lxpf-icon lxpf-chevron h-4 w-4 shrink-0 text-emerald-500" />
          </button>
        ))}
      </section>

      {/* logout */}
      <button
        onClick={() => setSection("logout")}
        className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-[18px] bg-emerald-50 py-3 text-[13px] font-extrabold text-emerald-700 active:scale-[0.99]"
        style={{ boxShadow: "3px 3px 8px rgba(166,180,200,.4), -3px -3px 8px rgba(255,255,255,.9)" }}
      >
        <LogoutIcon className="lxpf-icon lxpf-wiggle h-4 w-4" /> Logout
      </button>

      <FundsModals mode={fundMode} setMode={setFundMode} />
      <ProfileSheets
        section={section}
        onClose={() => setSection(null)}
        state={state}
        patch={patch}
        onLogout={() => {
          setSection(null);
          logout();
        }}
      />
    </div>
  );
}
