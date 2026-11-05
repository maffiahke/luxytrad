import type { ReactNode } from "react";

interface IconProps {
  className?: string;
  strokeWidth?: number;
}

export function ChartLogo({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 40" className={className} fill="none" aria-hidden>
      <rect x="4" y="22" width="7" height="14" rx="1.5" fill="#10A35C" />
      <rect x="14" y="14" width="7" height="22" rx="1.5" fill="#10A35C" />
      <rect x="24" y="4" width="7" height="32" rx="1.5" fill="#17C273" />
      <path
        d="M6 26 L21 17 L30 10"
        stroke="#0E5C3A"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M36 12 L42 5 M42 5 h-6 M42 5 v6"
        stroke="#10A35C"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UsaFlagIcon({ className }: IconProps) {
  const stripe = 24 / 13;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <defs>
        <clipPath id="usa-flag-clip">
          <circle cx="12" cy="12" r="12" />
        </clipPath>
      </defs>
      <g clipPath="url(#usa-flag-clip)">
        <rect width="24" height="24" fill="#ffffff" />
        {[0, 2, 4, 6, 8, 10, 12].map((i) => (
          <rect key={i} y={i * stripe} width="24" height={stripe} fill="#c8102e" />
        ))}
        <rect width="11.6" height={stripe * 7} fill="#1f3f8f" />
        {[1.1, 3.0, 4.9].map((y) =>
          [1.4, 3.4, 5.4, 7.4, 9.4].map((x) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="0.55" fill="#ffffff" />
          )),
        )}
      </g>
      <circle cx="12" cy="12" r="11.5" fill="none" stroke="rgba(15,23,42,0.10)" strokeWidth="1" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TrendArrowIcon({ className, down = false }: IconProps & { down?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden style={undefined}>
      {down ? (
        <path d="M7 7l10 10M17 8.5V17H8.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M7 17L17 7M17 15.5V7H8.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="M5 12h13m0 0-5.5-5.5M18 12l-5.5 5.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CandleIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="M8 3v4m0 10v4M16 3v6m0 8v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="5.4" y="7" width="5.2" height="10" rx="1.4" stroke="currentColor" strokeWidth="1.8" />
      <rect x="13.4" y="9" width="5.2" height="8" rx="1.4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function ExpandIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HistoryIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M3.2 7.2A9 9 0 1 1 3 12"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path d="M3 3.5V8h4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 8v4.3l2.8 1.8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/* --- Navigation icon set: 24px grid, 1.9px stroke, rounded joins.
   Every nav icon takes `filled` for the active-tab state (solid glyph). --- */

const navStroke = (w?: number) => ({
  strokeWidth: w ?? 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export function HomeIcon({ className, strokeWidth, filled = false }: IconProps & { filled?: boolean }) {
  if (filled) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 2.55 2.86 9.9a1.15 1.15 0 0 0 .72 2.05h1.02v6.9a2.6 2.6 0 0 0 2.6 2.6h9.6a2.6 2.6 0 0 0 2.6-2.6v-6.9h1.02a1.15 1.15 0 0 0 .72-2.05L12 2.55Zm2.72 16.1a1.35 1.35 0 0 1-1.35 1.35h-2.74a1.35 1.35 0 0 1-1.35-1.35v-3.5a1.35 1.35 0 0 1 1.35-1.35h2.74a1.35 1.35 0 0 1 1.35 1.35v3.5Z"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden {...navStroke(strokeWidth)}>
      <path d="M3.4 10.4 12 3.5l8.6 6.9" />
      <path d="M5.6 9.2v9.5a1.7 1.7 0 0 0 1.7 1.7h9.4a1.7 1.7 0 0 0 1.7-1.7V9.2" />
      <path d="M9.6 20.4v-4.5a1.4 1.4 0 0 1 1.4-1.4h2a1.4 1.4 0 0 1 1.4 1.4v4.5" />
    </svg>
  );
}

/* Three-candle glyph — the right mental model for Markets */
export function MarketsIcon({ className, strokeWidth, filled = false }: IconProps & { filled?: boolean }) {
  const bodyFill = filled ? "currentColor" : "none";
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden {...navStroke(strokeWidth)}>
      <path d="M6 5.6v3.2M6 15.4v3" />
      <rect x="3.7" y="8.8" width="4.6" height="6.6" rx="1.5" fill={bodyFill} />
      <path d="M12 2.6v1.9M12 12.6v3.2" />
      <rect x="9.7" y="4.5" width="4.6" height="8.1" rx="1.5" fill={bodyFill} />
      <path d="M18 8.2v2.6M18 17.2v2.4" />
      <rect x="15.7" y="10.8" width="4.6" height="6.4" rx="1.5" fill={bodyFill} />
    </svg>
  );
}

/* Allocation pie — reads as "what my money is made of" */
export function PortfolioIcon({ className, strokeWidth, filled = false }: IconProps & { filled?: boolean }) {
  if (filled) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
        <path d="M12 2.6a9.4 9.4 0 1 0 9.4 9.4H12V2.6Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden {...navStroke(strokeWidth)}>
      <path d="M12 2.6a9.4 9.4 0 1 0 9.4 9.4H12V2.6Z" />
    </svg>
  );
}

/* Alias kept so other screens can reference the same glyph by its old name */
export function BriefcaseIcon({ className, strokeWidth, filled }: IconProps & { filled?: boolean }) {
  return <PortfolioIcon className={className} strokeWidth={strokeWidth} filled={filled} />;
}

export function ProfileIcon({ className, strokeWidth, filled = false }: IconProps & { filled?: boolean }) {
  if (filled) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
        <circle cx="12" cy="7.8" r="4.4" />
        <path d="M12 14.2c-4.4 0-7.9 3.1-7.9 7v.3a.9.9 0 0 0 .9.9h14a.9.9 0 0 0 .9-.9v-.3c0-3.9-3.5-7-7.9-7Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" aria-hidden {...navStroke(strokeWidth)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c0-3.9 3.4-6.7 7.5-6.7s7.5 2.8 7.5 6.7" />
    </svg>
  );
}

export function CrownIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M3.5 8.5c.8 0 1.5-.7 1.5-1.5S4.3 5.5 3.5 5.5 2 6.2 2 7s.7 1.5 1.5 1.5ZM12 6.3c.9 0 1.6-.7 1.6-1.6S12.9 3 12 3s-1.6.7-1.6 1.6.7 1.7 1.6 1.7ZM20.5 8.5c.8 0 1.5-.7 1.5-1.5s-.7-1.5-1.5-1.5S19 6.2 19 7s.7 1.5 1.5 1.5ZM12 9.2l3.2 3.2 4.6-2.3L18 19H6L4.2 10l4.6 2.4L12 9.2Z" />
    </svg>
  );
}

export function WifiIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 14" className={className} fill="currentColor" aria-hidden>
      <path d="M10 11.6a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8ZM10 7.4c1.7 0 3.2.7 4.3 1.8l-1.5 1.5A4 4 0 0 0 10 9.6c-1 0-2 .4-2.8 1.1L5.7 9.2A6 6 0 0 1 10 7.4Zm0-4.2c2.8 0 5.4 1.1 7.3 3l-1.5 1.5A8.1 8.1 0 0 0 10 5.3c-2.2 0-4.3.9-5.8 2.4L2.7 6.2A10.2 10.2 0 0 1 10 3.2Z" />
    </svg>
  );
}

export function CellularIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 20 14" className={className} fill="currentColor" aria-hidden>
      <rect x="0" y="9" width="3.4" height="5" rx="1" />
      <rect x="5" y="6.4" width="3.4" height="7.6" rx="1" />
      <rect x="10" y="3.6" width="3.4" height="10.4" rx="1" opacity="0.4" />
      <rect x="15" y="1" width="3.4" height="13" rx="1" opacity="0.4" />
    </svg>
  );
}

export function BatteryIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 27 13" className={className} fill="none" aria-hidden>
      <rect x="0.5" y="0.5" width="23" height="12" rx="4" stroke="rgba(15,23,42,0.4)" />
      <rect x="2" y="2" width="20" height="9" rx="2.5" fill="#0f172a" />
      <path d="M25 4.5v4a2.2 2.2 0 0 0 0-4Z" fill="rgba(15,23,42,0.4)" />
    </svg>
  );
}

export function AvatarBadge({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#18C275" />
      <path d="m7.2 12.4 3.2 3.2 6.4-6.6" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CopyIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M15 5.5A2.5 2.5 0 0 0 12.5 3h-6A3.5 3.5 0 0 0 3 6.5v7A2.5 2.5 0 0 0 5.5 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AlertIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.1" />
      <path d="M12 7.2v5.4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="12" cy="16.4" r="1.25" fill="currentColor" />
    </svg>
  );
}

export function ClockIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.1" />
      <path d="M12 7.5V12l3.2 2" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LockIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.6" stroke="currentColor" strokeWidth="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="15.4" r="1.4" fill="currentColor" />
      <path d="M12 16.4v1.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function UserIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M4.5 20.5c0-3.9 3.4-6.7 7.5-6.7s7.5 2.8 7.5 6.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function AtIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M16 8v3.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PhoneIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <rect x="7" y="2.8" width="10" height="18.4" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <path d="M10.5 18.6h3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="5.8" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function MailIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <rect x="2.8" y="5" width="18.4" height="14" rx="2.6" stroke="currentColor" strokeWidth="2" />
      <path d="m4.6 7.6 6.2 4.6a2 2 0 0 0 2.4 0l6.2-4.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function UploadIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="M12 15V5m0 0 3.5 3.5M12 5 8.5 8.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 16.5v1.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function BellIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 3a6 6 0 0 0-6 6v3.2c0 .6-.2 1.2-.7 1.7l-.9 1c-.5.5-.1 1.6.7 1.6h13.8c.8 0 1.2-1.1.7-1.6l-.9-1a2.4 2.4 0 0 1-.7-1.7V9a6 6 0 0 0-6-6Zm-2.4 15a2.5 2.5 0 0 0 4.8 0" />
    </svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="2.2" />
      <path d="m15.5 15.5 5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function StarIcon({ className, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? "#f5b301" : "none"} aria-hidden>
      <path
        d="m12 3.6 2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 3.6Z"
        stroke={filled ? "#e09a00" : "currentColor"}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EyeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.8" fill="currentColor" />
    </svg>
  );
}

export function TargetIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    </svg>
  );
}

export function WalletIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h9A2.5 2.5 0 0 1 18 7.5V8h1.5A1.5 1.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-12A2.5 2.5 0 0 1 4 17.5v-10Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M4 8h14" stroke="currentColor" strokeWidth="2" />
      <circle cx="16.5" cy="13.8" r="1.3" fill="currentColor" />
    </svg>
  );
}

export function TrophyIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="M8 4h8v5.5a4 4 0 0 1-8 0V4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 5.5H5.5a3 3 0 0 0 3 4M16 5.5h2.5a3 3 0 0 1-3 4M12 13.5V17m-3.5 3h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function DownloadIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="M12 4v9m0 0 3.5-3.5M12 13 8.5 9.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 16.5v1.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function GearIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Zm8.9 4.5.1-2.2-2.3-.9a6.7 6.7 0 0 0-.7-1.6l1-2.2-1.6-1.6-2.2 1c-.5-.3-1-.5-1.6-.7L12.8 2.3h-2.2l-.9 2.3c-.6.2-1.1.4-1.6.7l-2.2-1L4.3 5.9l1 2.2c-.3.5-.5 1-.7 1.6l-2.3.9.1 2.2 2.2.9c.2.6.4 1.1.7 1.6l-1 2.2 1.6 1.6 2.2-1c.5.3 1 .5 1.6.7l.9 2.3h2.2l.8-2.3c.6-.2 1.1-.4 1.6-.7l2.2 1 1.6-1.6-1-2.2c.3-.5.5-1 .7-1.6l2.2-.9Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

export function DocIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="M7 3.5h7L19 8v11a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7.5 3.5H7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9.5 12h5m-5 3h5m-5-6h2.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

export function ShieldIcon({ className, check = false }: IconProps & { check?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="M12 2.8 5 5.4v5.2c0 4.6 3 8.4 7 10 4-1.6 7-5.4 7-10V5.4l-7-2.6Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      {check && <path d="m9 11.8 2.2 2.2 3.8-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      {!check && <circle cx="12" cy="11" r="2" fill="currentColor" />}
    </svg>
  );
}

export function GlobeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M3 12h18M12 3c2.7 2.5 4 5.7 4 9s-1.3 6.5-4 9c-2.7-2.5-4-5.7-4-9s1.3-6.5 4-9Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function HelpIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="currentColor" />
      <path d="M9.4 9.2a2.7 2.7 0 0 1 5.3.9c0 1.8-2.6 1.9-2.6 3.4" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
      <circle cx="12" cy="16.8" r="1.1" fill="#fff" />
    </svg>
  );
}

export function InfoIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 10.4v5.2" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="7.6" r="1.2" fill="#fff" />
    </svg>
  );
}

export function LogoutIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M4 12h10m0 0-3.5-3.5M14 12l-3.5 3.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Robot({ className }: IconProps): ReactNode {
  return (
    <svg viewBox="0 0 72 72" className={className} aria-hidden>
      <defs>
        <radialGradient id="rb-glow" cx="50%" cy="18%" r="45%">
          <stop offset="0%" stopColor="#2fd4ff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#0b4f33" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="rb-shell" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f8fdff" />
          <stop offset="100%" stopColor="#c7d9e4" />
        </linearGradient>
        <linearGradient id="rb-visor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#123b2e" />
          <stop offset="100%" stopColor="#07231b" />
        </linearGradient>
      </defs>
      <circle cx="36" cy="30" r="26" fill="url(#rb-glow)" />
      {/* antenna */}
      <line x1="36" y1="6" x2="36" y2="12" stroke="#dfe9f0" strokeWidth="3" strokeLinecap="round" />
      <circle cx="36" cy="5" r="3" fill="#35e0b0" />
      {/* head */}
      <rect x="14" y="12" width="44" height="30" rx="12" fill="url(#rb-shell)" />
      <rect x="20" y="19" width="32" height="15" rx="7.5" fill="url(#rb-visor)" />
      <circle cx="29" cy="26.5" r="3.4" fill="#3fe0ff" />
      <circle cx="43" cy="26.5" r="3.4" fill="#3fe0ff" />
      {/* ears */}
      <rect x="10" y="22" width="4" height="10" rx="2" fill="#a9c2d3" />
      <rect x="58" y="22" width="4" height="10" rx="2" fill="#a9c2d3" />
      {/* body */}
      <path d="M22 46c0-4 4-7 8-7h12c4 0 8 3 8 7v6c0 4-4 7-8 7H30c-4 0-8-3-8-7v-6Z" fill="url(#rb-shell)" />
      <circle cx="36" cy="51" r="4.2" fill="#35e0b0" stroke="#0d3b2a" strokeWidth="1.6" />
      <rect x="15" y="44" width="4" height="9" rx="2" fill="#c7d9e4" transform="rotate(18 17 48)" />
      <rect x="53" y="44" width="4" height="9" rx="2" fill="#c7d9e4" transform="rotate(-18 55 48)" />
    </svg>
  );
}
