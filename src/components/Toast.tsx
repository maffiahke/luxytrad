import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertIcon, CheckIcon, CloseIcon, InfoIcon } from "./icons";

export type ToastVariant = "success" | "error" | "info";

export interface ToastOptions {
  title?: string;
  description?: string;
  /** ms before auto-dismiss; 0 keeps it until manually closed */
  duration?: number;
  variant?: ToastVariant;
}

interface ToastItem {
  id: number;
  variant: ToastVariant;
  title?: string;
  description?: string;
  duration: number;
}

interface ToastApi {
  show: (opts: ToastOptions) => number;
  success: (title: string, description?: string, duration?: number) => number;
  error: (title: string, description?: string, duration?: number) => number;
  info: (title: string, description?: string, duration?: number) => number;
  dismiss: (id: number) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  success: 3200,
  error: 4400,
  info: 3200,
};

const EXIT_MS = 260;

const variantStyle: Record<
  ToastVariant,
  { chip: string; bar: string; ring: string; icon: ReactNode }
> = {
  success: {
    chip: "bg-[linear-gradient(160deg,#1fc47d,#0b8a4c)]",
    bar: "bg-emerald-500",
    ring: "ring-emerald-100",
    icon: <CheckIcon className="h-4 w-4" />,
  },
  error: {
    chip: "bg-[linear-gradient(160deg,#fa6376,#d1213a)]",
    bar: "bg-red-500",
    ring: "ring-red-100",
    icon: <AlertIcon className="h-[18px] w-[18px]" />,
  },
  info: {
    chip: "bg-[linear-gradient(160deg,#5b6b86,#334155)]",
    bar: "bg-slate-500",
    ring: "ring-slate-100",
    icon: <InfoIcon className="h-[18px] w-[18px]" />,
  },
};

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const remaining = useRef(toast.duration);
  const startedAt = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  const close = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => onDismiss(toast.id), EXIT_MS);
  }, [toast.id, onDismiss]);

  // auto-dismiss timer, pausable on hover
  useEffect(() => {
    if (leaving || paused || toast.duration <= 0) return;
    startedAt.current = Date.now();
    timer.current = window.setTimeout(close, remaining.current);
    return () => {
      window.clearTimeout(timer.current);
      if (!leaving) remaining.current -= Date.now() - startedAt.current;
    };
  }, [paused, leaving, close, toast.duration]);

  const s = variantStyle[toast.variant];

  return (
    <div
      role={toast.variant === "error" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={`neu-sm pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-[16px] bg-white py-2.5 pl-2.5 pr-2 ring-1 ${s.ring} ${
        leaving ? "anim-toast-out" : "anim-toast-in"
      }`}
    >
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white shadow-[0_4px_10px_rgba(0,0,0,0.12)] ${s.chip}`}
      >
        {s.icon}
      </span>

      <div className="min-w-0 flex-1 pt-0.5">
        {toast.title && (
          <p className="text-[13px] font-extrabold leading-tight text-slate-900">{toast.title}</p>
        )}
        {toast.description && (
          <p className="mt-0.5 text-[11.5px] font-medium leading-snug text-slate-500">{toast.description}</p>
        )}
      </div>

      <button
        type="button"
        onClick={close}
        aria-label="Dismiss notification"
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 active:scale-90"
      >
        <CloseIcon className="h-3.5 w-3.5" />
      </button>

      {toast.duration > 0 && (
        <span
          className={`toast-progress absolute bottom-0 left-0 ${s.bar}`}
          style={{
            animationDuration: `${toast.duration}ms`,
            animationPlayState: paused ? "paused" : "running",
          }}
        />
      )}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((opts: ToastOptions) => {
    const variant = opts.variant ?? "info";
    const id = ++seq.current;
    const item: ToastItem = {
      id,
      variant,
      title: opts.title,
      description: opts.description,
      duration: opts.duration ?? DEFAULT_DURATION[variant],
    };
    setToasts((list) => [...list.slice(-3), item]); // cap stack at 4
    return id;
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      dismiss,
      success: (title, description, duration) => show({ variant: "success", title, description, duration }),
      error: (title, description, duration) => show({ variant: "error", title, description, duration }),
      info: (title, description, duration) => show({ variant: "info", title, description, duration }),
    }),
    [show, dismiss],
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center">
        <div className="mt-3 flex w-full max-w-[430px] flex-col gap-2 px-4">
          {toasts.map((t) => (
            <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </div>
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
