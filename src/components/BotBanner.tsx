import { useApp, formatDuration } from "../state/AppStore";
import { ArrowRightIcon, CrownIcon, Robot } from "./icons";

const BOT_CSS = `
.lxbot-banner{position:relative;background:linear-gradient(105deg,#06301f 0%,#0b4d31 45%,#11703f 72%,#0b4d31 100%);background-size:220% 220%;animation:lxbot-pan 9s ease-in-out infinite;box-shadow:6px 6px 16px rgba(6,48,31,0.35),-4px -4px 10px rgba(255,255,255,0.55);}
@keyframes lxbot-pan{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
.lxbot-sheen{position:absolute;inset:0;pointer-events:none;background:linear-gradient(115deg,transparent 32%,rgba(255,255,255,0.20) 48%,transparent 62%);transform:translateX(-130%);animation:lxbot-sheen 4.6s ease-in-out infinite;}
@keyframes lxbot-sheen{0%{transform:translateX(-130%)}55%,100%{transform:translateX(130%)}}
.lxbot-robot{animation:lxbot-float 3s ease-in-out infinite;}
@keyframes lxbot-float{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-3px) rotate(2deg)}}
.lxbot-glow{position:absolute;inset:-3px;border-radius:9999px;background:radial-gradient(circle,rgba(46,181,105,0.55),transparent 70%);animation:lxbot-pulse 2.4s ease-in-out infinite;}
@keyframes lxbot-pulse{0%,100%{opacity:0.3;transform:scale(0.82)}50%{opacity:0.85;transform:scale(1.12)}}
.lxbot-crown{transform-origin:center;animation:lxbot-twinkle 2s ease-in-out infinite;}
@keyframes lxbot-twinkle{0%,100%{transform:scale(1) rotate(0)}50%{transform:scale(1.28) rotate(-14deg)}}
.lxbot-title{background:linear-gradient(90deg,#ffffff 0%,#a7f3d0 22%,#ffffff 48%,#fcd34d 72%,#ffffff 100%);background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:lxbot-shimmer 3.6s linear infinite;}
@keyframes lxbot-shimmer{to{background-position:200% center}}
.lxbot-pill{position:relative;animation:lxbot-pillglow 2s ease-in-out infinite;}
@keyframes lxbot-pillglow{0%,100%{box-shadow:0 6px 14px rgba(0,0,0,0.35),0 0 0 0 rgba(252,211,77,0.55)}50%{box-shadow:0 6px 14px rgba(0,0,0,0.35),0 0 0 7px rgba(252,211,77,0)}}
.lxbot-arrow-icon{animation:lxbot-nudge 1.4s ease-in-out infinite;}
@keyframes lxbot-nudge{0%,100%{transform:translateX(0)}50%{transform:translateX(3px)}}
.lxbot-line{stroke-dasharray:150;stroke-dashoffset:150;animation:lxbot-draw 4.2s ease-in-out infinite;}
@keyframes lxbot-draw{0%{stroke-dashoffset:150}45%,58%{stroke-dashoffset:0}100%{stroke-dashoffset:-150}}
.lxbot-tip{animation:lxbot-blink 1.4s ease-in-out infinite;}
@keyframes lxbot-blink{0%,100%{opacity:0.35}50%{opacity:1}}
.lxbot-spark{position:absolute;width:4px;height:4px;border-radius:9999px;pointer-events:none;opacity:0;background:rgba(252,211,77,0.95);animation:lxbot-rise 5s ease-in-out infinite;}
.lxbot-spark--1{left:22%;bottom:8px;animation-delay:0.2s}
.lxbot-spark--2{left:56%;bottom:6px;animation-delay:1.8s;background:rgba(167,243,208,0.95)}
.lxbot-spark--3{left:80%;bottom:10px;animation-delay:3.2s}
@keyframes lxbot-rise{0%{opacity:0;transform:translateY(0) scale(0.6)}18%{opacity:0.95}80%{opacity:0.5}100%{opacity:0;transform:translateY(-36px) scale(1)}}
.lxbot-btn{transition:transform 0.15s ease;}
.lxbot-btn:hover .lxbot-banner{background-position:100% 50%;}
.lxbot-btn:active{transform:scale(0.99);}
@media (prefers-reduced-motion: reduce){.lxbot-banner,.lxbot-banner *{animation:none !important;}}
`;

export function BotBanner({ onActivate }: { onActivate: () => void }) {
  const { activeBot, haltBot } = useApp();

  if (activeBot) {
    return (
      <section
        className="mx-3 my-1 overflow-hidden rounded-[20px] bg-[linear-gradient(105deg,#06301f_0%,#0b4d31_55%,#11703f_100%)]"
        style={{ boxShadow: "6px 6px 16px rgba(6,48,31,0.35), -4px -4px 10px rgba(255,255,255,0.55)" }}
      >
        <div className="flex items-center gap-2.5 px-3 py-1.5">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
            <span className="absolute inline-flex h-8 w-8 animate-ping rounded-full bg-emerald-400/40" />
            <Robot className="relative h-10 w-10 drop-shadow-[0_6px_10px_rgba(0,0,0,0.35)]" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-300">Bot running</span>
            </div>
            <div className="mt-0.5 truncate text-[15px] font-extrabold leading-tight text-white">
              {activeBot.market}
              <span className="ml-1.5 text-[11px] font-bold text-emerald-100/90">
                ${activeBot.stake.toLocaleString("en-US")} · {formatDuration(activeBot.duration)} · {activeBot.done}/{activeBot.total}
              </span>
            </div>
            <div
              className={`text-[11px] font-extrabold tabular-nums ${
                activeBot.realized >= 0 ? "text-emerald-300" : "text-red-300"
              }`}
            >
              {activeBot.realized >= 0 ? "+" : "-"}${Math.abs(activeBot.realized).toFixed(2)} realized
            </div>
          </div>

          <button
            onClick={() => haltBot(activeBot.id)}
            className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-extrabold text-white ring-1 ring-white/25 active:scale-95"
          >
            Stop
          </button>
        </div>
      </section>
    );
  }

  return (
    <button onClick={onActivate} className="lxbot-btn block w-full text-left" aria-label="Run trading bot">
      <style>{BOT_CSS}</style>
      <section className="lxbot-banner mx-3 my-1 overflow-hidden rounded-[20px]">
        <span className="lxbot-sheen" aria-hidden />
        <span className="lxbot-spark lxbot-spark--1" aria-hidden />
        <span className="lxbot-spark lxbot-spark--2" aria-hidden />
        <span className="lxbot-spark lxbot-spark--3" aria-hidden />

        <div className="relative flex items-center gap-2.5 px-3 py-1.5">
          {/* faint chart silhouette behind the robot */}
          <svg
            viewBox="0 0 120 70"
            className="pointer-events-none absolute left-14 top-1 h-10 w-16 opacity-30"
            aria-hidden
          >
            <path className="lxbot-line" d="M2 66 L20 52 L38 58 L56 36 L74 42 L98 16" stroke="#1d8a54" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path className="lxbot-tip" d="M100 26 v-8 h-8" stroke="#2eb569" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
          </svg>

          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
            <span className="lxbot-glow" aria-hidden />
            <Robot className="lxbot-robot relative h-10 w-10 drop-shadow-[0_6px_10px_rgba(0,0,0,0.35)]" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <CrownIcon className="lxbot-crown h-3.5 w-3.5 text-[#f7c948]" />
              <span className="text-[10.5px] font-semibold text-emerald-300">Scalper Profitable Trading bot</span>
            </div>
            <div className="lxbot-title mt-0.5 text-[16px] font-extrabold leading-tight">Gridolar Scalper</div>
            <div className="text-[10.5px] font-medium text-emerald-100/90">Let AI Trade for You 24/7</div>
          </div>

          <span className="lxbot-pill flex shrink-0 items-center gap-1 rounded-full bg-[linear-gradient(#fcd34d,#f0b429)] px-3 py-1.5 text-[11px] font-extrabold text-[#3f2d05]">
            Run bot
            <ArrowRightIcon className="lxbot-arrow-icon h-3 w-3" />
          </span>
        </div>
      </section>
    </button>
  );
}
