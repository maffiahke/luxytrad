import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeftIcon, CloseIcon } from "./icons";

/* ------------------------------ shared ui bits ------------------------------ */

export const btnContinue =
  "mt-3 flex w-full items-center justify-center gap-2 rounded-[16px] bg-emerald-600 py-3 text-[13.5px] font-extrabold text-white shadow-[0_8px_18px_rgba(16,122,74,0.35)] active:scale-[0.98]";
export const btnSecondary =
  "mt-2 flex w-full items-center justify-center rounded-[16px] bg-white py-2.5 text-[12.5px] font-bold text-slate-600 shadow-[3px_3px_9px_rgba(166,180,200,0.45),-3px_-3px_9px_rgba(255,255,255,0.95)]";
export const fieldLabel = "mb-1 block text-[11.5px] font-bold text-slate-600";
export const fieldInput =
  "neu-sm w-full rounded-[14px] bg-white px-3 py-2.5 text-[13px] font-bold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400";

function useAnimatedVisibility(open: boolean) {
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(t);
  }, [open]);
  return { mounted, shown };
}

export function ModalShell({
  open,
  onClose,
  onBack,
  title,
  subtitle,
  children,
  bodyClassName = "max-h-[62vh]",
}: {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  bodyClassName?: string;
}) {
  const { mounted, shown } = useAnimatedVisibility(open);
  if (!mounted) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button
        aria-label="Close"
        onClick={onClose}
        className={`absolute inset-0 bg-slate-900/45 transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className={`relative w-full max-w-[430px] rounded-t-[26px] bg-[#f2f5f9] pb-6 pt-2 shadow-[0_-12px_40px_rgba(15,40,30,0.3)] transition-all duration-200 ${shown ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
      >
        <div className="mx-auto mb-1 h-1.5 w-10 rounded-full bg-slate-300" />
        <div className="flex items-start gap-2 px-4 pb-2 pt-1">
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Go back"
              className="neu-sm -ml-1 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-slate-600 active:scale-95"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] font-extrabold text-slate-900">{title}</h3>
            {subtitle && <p className="text-[11px] font-medium text-slate-500">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="neu-sm flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className={`${bodyClassName} overflow-y-auto px-4 pt-1`}>{children}</div>
      </div>
    </div>
  );
}

export function Step({ children }: { children: ReactNode }) {
  return <div className="animate-[step-in_0.25s_ease-out]">{children}</div>;
}
