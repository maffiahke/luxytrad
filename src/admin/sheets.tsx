import { useEffect, useState, type ReactNode } from "react";
import { useBreakpoint } from "./hooks";
import { btnContinue, btnSecondary } from "../components/Sheet";
import { CloseIcon } from "../components/icons";

function useMounted(open: boolean) {
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), 220);
    return () => clearTimeout(t);
  }, [open]);
  return { mounted, shown };
}

/** Responsive panel: right-docked on desktop, full-height bottom sheet on phone. */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { mounted, shown } = useMounted(open);
  const bp = useBreakpoint();
  const dockRight = bp !== "mobile";
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex ${dockRight ? "justify-end" : "items-end"} ${
        shown ? "pointer-events-auto" : "pointer-events-none"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className={`absolute inset-0 bg-slate-900/45 transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className={`relative flex flex-col bg-[#f2f5f9] shadow-[0_-12px_40px_rgba(15,40,30,0.28)] transition-all duration-200 ${
          dockRight
            ? `h-full w-full max-w-[460px] ${shown ? "translate-x-0" : "translate-x-full"}`
            : `max-h-[92vh] w-full rounded-t-[26px] pb-[env(safe-area-inset-bottom)] ${shown ? "translate-y-0" : "translate-y-10"}`
        }`}
      >
        {!dockRight && <div className="mx-auto mt-2 mb-1 h-1.5 w-10 rounded-full bg-slate-300" />}
        <div className="flex items-start gap-2 px-4 pb-2 pt-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] font-extrabold text-slate-900">{title}</h3>
            {subtitle && <p className="text-[11.5px] font-medium text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="neu-sm flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 active:scale-95">
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
        {footer && <div className="border-t border-slate-200 bg-white/70 px-4 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-[11.5px] font-bold text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[10.5px] font-medium text-slate-400">{hint}</span>}
    </label>
  );
}

export const inputCls =
  "w-full min-h-[44px] rounded-[12px] bg-white px-3 py-2.5 text-[14px] font-bold text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-300 placeholder:font-medium placeholder:text-slate-400";

/** reason-gated confirm used by every destructive / approving action */
export function ConfirmSheet({
  open,
  onClose,
  title,
  body,
  requireReason,
  confirmLabel = "Confirm",
  danger,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body?: string;
  requireReason?: boolean;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (open) setReason("");
  }, [open]);
  const blocked = !!requireReason && reason.trim().length < 3;
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-2">
          <button className={btnSecondary + " flex-1"} onClick={onClose}>
            Cancel
          </button>
          <button
            className={btnContinue + " flex-1" + (danger ? " !bg-rose-600 !shadow-[0_8px_18px_rgba(225,29,72,0.35)]" : "")}
            disabled={blocked}
            style={blocked ? { opacity: 0.4 } : undefined}
            onClick={() => onConfirm(reason.trim())}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      {body && <p className="mb-3 text-[13px] font-medium text-slate-600">{body}</p>}
      {requireReason && (
        <Field label="Reason (required)">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className={inputCls + " resize-none"}
            placeholder="Add a note for the audit log…"
          />
        </Field>
      )}
    </Drawer>
  );
}

/** thumb-reachable sticky action bar for mobile detail views */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 mt-3 flex gap-2 border-t border-slate-200 bg-white/85 px-4 py-3 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0">
      {children}
    </div>
  );
}
