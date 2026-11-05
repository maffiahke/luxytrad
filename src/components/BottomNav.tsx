import { HomeIcon, MarketsIcon, PortfolioIcon, ProfileIcon } from "./icons";

const items = [
  { id: "home", label: "Home", Icon: HomeIcon },
  { id: "markets", label: "Markets", Icon: MarketsIcon },
  { id: "portfolio", label: "Portfolio", Icon: PortfolioIcon },
  { id: "profile", label: "Profile", Icon: ProfileIcon },
] as const;

interface BottomNavProps {
  active: string;
  onChange: (id: string) => void;
}

export function BottomNav({ active, onChange }: BottomNavProps) {
  const activeIndex = Math.max(
    0,
    items.findIndex((i) => i.id === active),
  );

  return (
    <nav aria-label="Main navigation" className="relative mt-auto px-3 pb-1 pt-2">
      {/* Floating glass bar */}
      <div
        className="relative rounded-[26px] bg-white/85 ring-1 ring-white/80 backdrop-blur-xl"
        style={{
          boxShadow:
            "0 14px 30px -12px rgba(15,42,32,0.34), 0 3px 8px -3px rgba(15,42,32,0.10), inset 0 1px 0 rgba(255,255,255,0.95)",
        }}
      >
        {/* Top light catch */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-7 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent"
        />

        <div className="relative flex items-stretch px-1.5 py-1.5">
          {/* Sliding active tab — glides between positions */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-1.5 left-1.5 rounded-[20px] transition-transform duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              width: "calc((100% - 12px) / 4)",
              transform: `translateX(${activeIndex * 100}%)`,
              background:
                "linear-gradient(165deg, #24c47e 0%, #10a35c 55%, #0a8a4b 100%)",
              boxShadow:
                "0 8px 18px -6px rgba(11,138,76,0.62), 0 2px 5px rgba(11,138,76,0.22), inset 0 1px 0 rgba(255,255,255,0.38), inset 0 -2px 6px rgba(6,90,50,0.28)",
            }}
          />

          {items.map(({ id, label, Icon }) => {
            const isActive = id === active;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange(id)}
                aria-current={isActive ? "page" : undefined}
                aria-label={label}
                className="group relative z-10 flex flex-1 flex-col items-center justify-center gap-[3px] rounded-[20px] py-2 outline-none transition-transform duration-150 active:scale-[0.94] focus-visible:ring-2 focus-visible:ring-emerald-400/70"
              >
                <Icon
                  filled={isActive}
                  strokeWidth={isActive ? 2 : 1.85}
                  className={`h-[22px] w-[22px] transition-all duration-300 ${
                    isActive
                      ? "-translate-y-px scale-105 text-white drop-shadow-[0_1px_2px_rgba(6,90,50,0.35)]"
                      : "text-slate-400 group-hover:text-slate-500"
                  }`}
                />
                <span
                  className={`text-[10px] leading-none tracking-[0.01em] transition-colors duration-300 ${
                    isActive
                      ? "font-bold text-white"
                      : "font-semibold text-slate-500 group-hover:text-slate-600"
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* iOS home indicator */}
      <div className="flex justify-center pb-1.5 pt-2">
        <div className="h-[5px] w-[134px] rounded-full bg-emerald-950/80" />
      </div>
    </nav>
  );
}
