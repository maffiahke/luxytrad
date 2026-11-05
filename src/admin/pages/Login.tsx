import { useState } from "react";
import { useAdmin } from "../AdminStore";
import { useToast } from "../../components/Toast";
import { ChartLogo, LockIcon, AtIcon } from "../../components/icons";

export function Login() {
  const { signIn } = useAdmin();
  const toast = useToast();
  const [email, setEmail] = useState("admin@luxytrades.io");
  const [password, setPassword] = useState("demo1234");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await signIn(email, password);
      toast.success("Welcome back", "You're signed in to the admin console.");
    } catch {
      toast.error("Sign in failed", "Check your email and password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-[440px] flex-col items-center justify-center bg-[#eef1f6] px-5">
      <div className="anim-fade-up mb-6 flex flex-col items-center text-center">
        <div className="grid h-16 w-16 place-items-center rounded-[20px] bg-[linear-gradient(160deg,#1fc47d,#0b8a4c)] text-white shadow-[0_10px_22px_rgba(11,138,76,0.35)]">
          <ChartLogo className="h-8 w-8" />
        </div>
        <h1 className="mt-3 text-[22px] font-extrabold text-slate-900">Luxytrades Admin</h1>
        <p className="text-[12.5px] font-semibold text-slate-500">Back-office console</p>
      </div>

      <div className="neu anim-rise-in w-full rounded-[22px] bg-white p-5">
        <label className="mb-3 block">
          <span className="mb-1 flex items-center gap-1.5 text-[11.5px] font-bold text-slate-600">
            <AtIcon className="h-4 w-4 text-slate-400" /> Email
          </span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            inputMode="email"
            className="w-full rounded-[12px] bg-white px-3 py-2.5 text-[14px] font-bold text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-300"
          />
        </label>
        <label className="mb-1 block">
          <span className="mb-1 flex items-center gap-1.5 text-[11.5px] font-bold text-slate-600">
            <LockIcon className="h-4 w-4 text-slate-400" /> Password
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-[12px] bg-white px-3 py-2.5 text-[14px] font-bold text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-300"
          />
        </label>
        <button
          onClick={submit}
          disabled={busy}
          className="neu-buy mt-4 flex w-full items-center justify-center gap-2 py-3 text-white active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : "Sign in →"}
        </button>

        <p className="mt-3 text-center text-[11px] font-semibold text-slate-400">
          Demo: any email + 4-char password. Prefix <span className="font-extrabold text-slate-500">finance/ops/support/audit</span> to switch role.
        </p>
      </div>
    </div>
  );
}
