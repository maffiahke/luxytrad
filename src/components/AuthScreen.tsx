import { useEffect, useRef, useState, type ReactNode } from "react";
import { detectCountryFromIp, detectCountrySync, type Country, type CountryGuess } from "../data/countries";
import { CountryPicker, CountryTrigger } from "./CountryPicker";
import { useToast } from "./Toast";
import { ChartLogo, EyeIcon, LockIcon, UserIcon, AtIcon, PhoneIcon, CheckIcon, ShieldIcon } from "./icons";
import { ApiRequestError, login, register, setToken } from "../api/trader";

export type AuthMode = "login" | "register";

const fieldBox = "neu-sm flex items-center gap-2 rounded-[15px] bg-white px-3 py-2.5";
const inputCls =
  "min-w-0 flex-1 bg-transparent text-[14.5px] font-bold text-slate-900 outline-none placeholder:font-medium placeholder:text-slate-400";
const labelCls = "mb-1.5 block text-[12px] font-bold text-slate-600";
const btnPrimary =
  "mt-5 flex w-full items-center justify-center gap-2 rounded-[16px] bg-[linear-gradient(160deg,#1fc47d,#0b8a4c)] py-3.5 text-[15px] font-extrabold text-white shadow-[0_10px_22px_rgba(11,128,70,0.32)] transition-transform active:scale-[0.98] disabled:opacity-60";

const digitsOnly = (s: string) => s.replace(/\D/g, "");

function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between">
      <label className={labelCls}>{children}</label>
      {hint && <span className="mb-1.5 text-[10.5px] font-semibold text-slate-400">{hint}</span>}
    </div>
  );
}

function ErrorText({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="anim-fade-up mt-1.5 text-[11px] font-bold text-red-500">{msg}</p>;
}

function TextField({
  icon,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
  maxLength,
  invalid,
  onEnter,
}: {
  icon: ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  inputMode?: "text" | "tel" | "numeric";
  maxLength?: number;
  invalid?: boolean;
  onEnter?: () => void;
}) {
  return (
    <div
      className={`${fieldBox} transition-shadow ${invalid ? "ring-2 ring-red-300" : "focus-within:ring-2 focus-within:ring-emerald-300"}`}
    >
      <span className={`shrink-0 ${invalid ? "text-red-400" : "text-slate-400"}`}>{icon}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        placeholder={placeholder}
        type={type}
        inputMode={inputMode}
        maxLength={maxLength}
        className={inputCls}
      />
    </div>
  );
}

function PasswordField({
  value,
  onChange,
  placeholder,
  invalid,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  invalid?: boolean;
  onEnter?: () => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div
      className={`${fieldBox} transition-shadow ${invalid ? "ring-2 ring-red-300" : "focus-within:ring-2 focus-within:ring-emerald-300"}`}
    >
      <LockIcon className={`h-[18px] w-[18px] shrink-0 ${invalid ? "text-red-400" : "text-slate-400"}`} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        placeholder={placeholder}
        type={show ? "text" : "password"}
        className={inputCls}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className={`shrink-0 rounded-md p-1 active:scale-90 ${show ? "text-emerald-600" : "text-slate-400"}`}
      >
        <EyeIcon className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}

function PhoneField({
  country,
  onCountryClick,
  value,
  onChange,
  invalid,
  onEnter,
}: {
  country: Country;
  onCountryClick: () => void;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  onEnter?: () => void;
}) {
  return (
    <div
      className={`${fieldBox} transition-shadow ${invalid ? "ring-2 ring-red-300" : "focus-within:ring-2 focus-within:ring-emerald-300"}`}
    >
      <CountryTrigger country={country} onClick={onCountryClick} />
      <span className="h-5 w-px shrink-0 bg-slate-200" />
      <PhoneIcon className={`h-[18px] w-[18px] shrink-0 ${invalid ? "text-red-400" : "text-slate-400"}`} />
      <input
        value={value}
        onChange={(e) => onChange(digitsOnly(e.target.value).slice(0, 12))}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        placeholder="712 345 678"
        inputMode="tel"
        className={inputCls}
      />
    </div>
  );
}

function strength(pw: string): number {
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}

function StrengthMeter({ pw }: { pw: string }) {
  if (!pw) return null;
  const score = strength(pw);
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];
  const colors = ["bg-red-400", "bg-red-400", "bg-amber-400", "bg-lime-500", "bg-emerald-500"];
  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-slate-200">
            {i < score && (
              <span
                key={`f-${score}`}
                className={`anim-grow-x block h-full rounded-full ${colors[score]}`}
                style={{ animationDelay: `${i * 70}ms` }}
              />
            )}
          </span>
        ))}
      </div>
      <p className="mt-1 text-[10.5px] font-bold text-slate-500">Password strength: {labels[score]}</p>
    </div>
  );
}

function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-start gap-2.5 text-left">
      <span
        className={`mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-[6px] border-2 transition-colors ${
          checked ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white"
        }`}
      >
        {checked && <CheckIcon className="h-3.5 w-3.5 animate-[pop-in_0.28s_ease-out]" />}
      </span>
      <span className="text-[11.5px] font-medium leading-snug text-slate-500">{children}</span>
    </button>
  );
}

export function AuthScreen({
  mode,
  onModeChange,
  onSuccess,
}: {
  mode: AuthMode;
  onModeChange: (m: AuthMode) => void;
  onSuccess: () => void;
}) {
  // Visitor location: an instant offline guess (timezone/locale/cached IP) is
  // resolved synchronously so the detected country shows the moment the form
  // mounts, then a best-effort IP lookup refines it in the background.
  const [geo, setGeo] = useState<CountryGuess>(detectCountrySync);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickedManually = useRef(false);

  const country = geo.country;

  useEffect(() => {
    let alive = true;
    detectCountryFromIp().then((g) => {
      if (alive && g && !pickedManually.current) setGeo(g);
    });
    return () => {
      alive = false;
    };
  }, []);

  // shared
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  // register-only
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [confirm, setConfirm] = useState("");
  const [referral, setReferral] = useState("");
  const [terms, setTerms] = useState(false);

  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const isLogin = mode === "login";
  // "auto" only while the country is still the machine's guess, not a manual pick.
  const autoLocated = geo.detected && !pickedManually.current;

  // staggered entrance: increments only for fields that actually render,
  // so login and register each get a tight, gapless cascade.
  let step = 0;
  const delay = () => ({ animationDelay: `${(step++) * 55}ms` });

  const resetErrors = () => setErrors({});

  const submit = async () => {
    const e: Record<string, string> = {};
    if (digitsOnly(phone).length < 7) e.phone = "Enter a valid phone number.";
    if (password.length < 6) e.password = "Password must be at least 6 characters.";

    if (!isLogin) {
      if (fullName.trim().length < 2) e.fullName = "Enter your full name.";
      if (!/^[a-zA-Z0-9_]{3,}$/.test(username)) e.username = "3+ characters, letters/numbers/underscore only.";
      if (confirm !== password || !confirm) e.confirm = "Passwords do not match.";
      if (referral && referral.trim().length < 3) e.referral = "Referral code looks too short.";
      if (!terms) e.terms = "Please accept the terms to continue.";
    }

    setErrors(e);
    if (Object.keys(e).length > 0) {
      if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        formRef.current?.animate(
          [
            { transform: "translateX(0)" },
            { transform: "translateX(-7px)" },
            { transform: "translateX(7px)" },
            { transform: "translateX(-5px)" },
            { transform: "translateX(5px)" },
            { transform: "translateX(0)" },
          ],
          { duration: 380, easing: "cubic-bezier(0.36,0.07,0.19,0.97)" },
        );
      }
      toast.error(
        "Please check the form",
        `${Object.keys(e).length} ${Object.keys(e).length === 1 ? "field needs" : "fields need"} your attention.`,
      );
      return;
    }

    setBusy(true);
    const phoneDigits = digitsOnly(phone);
    try {
      const res = isLogin
        ? await login(phoneDigits, password)
        : await register({
            fullName: fullName.trim(),
            username,
            phone: phoneDigits,
            password,
            countryCode: country.code,
            referralCode: referral.trim() || undefined,
          });
      setToken(res.token);
      toast.success(isLogin ? "Welcome back" : "You're all set", isLogin ? "You're now signed in." : "Your account has been created.");
      onSuccess();
    } catch (err) {
      const msg =
        err instanceof ApiRequestError
          ? err.message
          : "We couldn't reach the trading server. Check your connection and try again.";
      const field = isLogin ? "password" : "username";
      setErrors({ [field]: msg });
      toast.error(isLogin ? "Sign-in failed" : "Couldn't create account", msg);
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (m: AuthMode) => {
    resetErrors();
    onModeChange(m);
  };

  return (
    <div className="mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-[#eef1f6]">
      {/* ambient drifting background blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="anim-blob-a absolute -left-16 top-10 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(23,194,115,0.20),transparent_68%)] blur-2xl" />
        <div className="anim-blob-b absolute -right-20 top-40 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(124,92,230,0.16),transparent_68%)] blur-2xl" />
      </div>
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {/* brand header */}
        <div className="relative px-6 pb-2 pt-8">
          <div className="anim-glow pointer-events-none absolute -top-16 left-1/2 h-48 w-48 rounded-full bg-[radial-gradient(circle,rgba(23,194,115,0.22),transparent_70%)]" />
          <div className="relative flex flex-col items-center text-center">
            <div className="anim-float neu flex h-16 w-16 items-center justify-center rounded-[20px] bg-white">
              <ChartLogo className="h-9 w-10" />
            </div>
            <h1 className="anim-fade-up mt-3 text-[22px] font-extrabold tracking-tight text-slate-900" style={{ animationDelay: "120ms" }}>Luxytrades</h1>
            <p className="anim-fade-up mt-0.5 text-[12px] font-semibold text-emerald-600" style={{ animationDelay: "200ms" }}>Trade Smarter. Grow with Confidence.</p>
            <h2 className="anim-fade-up mt-5 text-[17px] font-extrabold text-slate-900" style={{ animationDelay: "280ms" }}>
              {isLogin ? "Welcome back" : "Create your account"}
            </h2>
            <p className="anim-fade-up mt-1 max-w-[280px] text-[12px] font-medium leading-relaxed text-slate-500" style={{ animationDelay: "340ms" }}>
              {isLogin
                ? "Log in with your phone number to keep trading."
                : "Sign up in a minute — start with a demo or go live when ready."}
            </p>
          </div>
        </div>

        {/* card */}
        <div className="px-4 pb-10">
          <div className="anim-rise neu rounded-[24px] bg-white p-4">
            {/* segmented switch with sliding thumb */}
            <div className="neu-sm relative mb-4 flex rounded-[14px] bg-white p-1">
              <span
                aria-hidden
                className="absolute left-1 top-1 bottom-1 rounded-[10px] bg-[linear-gradient(160deg,#1fc47d,#0b8a4c)] shadow-[0_6px_12px_rgba(11,128,70,0.28)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ width: "calc(50% - 4px)", transform: mode === "register" ? "translateX(100%)" : "translateX(0)" }}
              />
              {(["login", "register"] as AuthMode[]).map((m) => {
                const active = m === mode;
                return (
                  <button
                    key={m}
                    onClick={() => switchMode(m)}
                    className={`relative z-10 flex-1 rounded-[10px] py-2 text-[13px] font-extrabold transition-colors duration-200 active:scale-95 ${
                      active ? "text-white" : "text-slate-500"
                    }`}
                  >
                    {m === "login" ? "Log in" : "Sign up"}
                  </button>
                );
              })}
            </div>

            <div key={mode} ref={formRef} className="space-y-3.5">
              {!isLogin && (
                <div
                  className="anim-fade-up flex items-center gap-2.5 rounded-[14px] bg-[#e8f0fe] px-3 py-2 ring-1 ring-sky-100"
                  style={delay()}
                >
                  <span className="text-[18px] leading-none">{country.flag}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-extrabold text-sky-900">
                      {autoLocated
                        ? `We think you're in ${country.name}`
                        : pickedManually.current
                          ? `Country set to ${country.name}`
                          : "Set your country"}
                    </div>
                    <div className="truncate text-[10.5px] font-semibold text-sky-600">
                      {autoLocated
                        ? `Country code ${country.dial} pre-filled for your number`
                        : pickedManually.current
                          ? `Country code ${country.dial} · tap Change to edit`
                          : "We couldn't detect your location · tap Change"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="shrink-0 rounded-[9px] bg-white px-2.5 py-1 text-[11px] font-extrabold text-sky-700 active:scale-95"
                  >
                    Change
                  </button>
                </div>
              )}

              {!isLogin && (
                <div className="anim-fade-up" style={delay()}>
                  <Label>Full name</Label>
                  <TextField
                    icon={<UserIcon className="h-[18px] w-[18px]" />}
                    value={fullName}
                    onChange={(v) => {
                      setFullName(v);
                      if (errors.fullName) resetErrors();
                    }}
                    placeholder="Jane Wanjiru"
                    invalid={!!errors.fullName}
                  />
                  <ErrorText msg={errors.fullName} />
                </div>
              )}

              {!isLogin && (
                <div className="anim-fade-up" style={delay()}>
                  <Label hint="letters, numbers, _">Username</Label>
                  <TextField
                    icon={<AtIcon className="h-[18px] w-[18px]" />}
                    value={username}
                    onChange={(v) => {
                      setUsername(v.replace(/[^a-zA-Z0-9_]/g, ""));
                      if (errors.username) resetErrors();
                    }}
                    placeholder="jane_trades"
                    maxLength={20}
                    invalid={!!errors.username}
                  />
                  <ErrorText msg={errors.username} />
                </div>
              )}

              <div className="anim-fade-up" style={delay()}>
                <Label hint={isLogin ? undefined : "used for verification"}>Phone number</Label>
                <PhoneField
                  country={country}
                  onCountryClick={() => setPickerOpen(true)}
                  value={phone}
                  onChange={(v) => {
                    setPhone(v);
                    if (errors.phone) resetErrors();
                  }}
                  invalid={!!errors.phone}
                  onEnter={isLogin ? submit : undefined}
                />
                <ErrorText msg={errors.phone} />
              </div>

              <div className="anim-fade-up" style={delay()}>
                <div className="flex items-baseline justify-between">
                  <label className={labelCls}>Password</label>
                  {isLogin && (
                    <button
                      type="button"
                      onClick={() => {
                        setErrors((e) => ({ ...e, _forgot: "Password reset link sent to your phone." }));
                        toast.info("Reset link sent", "Check your phone for a password reset message.");
                      }}
                      className="mb-1.5 text-[11px] font-bold text-emerald-600 active:opacity-70"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <PasswordField
                  value={password}
                  onChange={(v) => {
                    setPassword(v);
                    if (errors.password) resetErrors();
                  }}
                  placeholder="••••••••"
                  invalid={!!errors.password}
                  onEnter={isLogin ? submit : undefined}
                />
                <ErrorText msg={errors.password} />
                {!isLogin && <StrengthMeter pw={password} />}
              </div>

              {!isLogin && (
                <div className="anim-fade-up" style={delay()}>
                  <Label>Confirm password</Label>
                  <PasswordField
                    value={confirm}
                    onChange={(v) => {
                      setConfirm(v);
                      if (errors.confirm) resetErrors();
                    }}
                    placeholder="Re-enter password"
                    invalid={!!errors.confirm}
                  />
                  <ErrorText msg={errors.confirm} />
                </div>
              )}

              {!isLogin && (
                <div className="anim-fade-up" style={delay()}>
                  <Label hint="optional">Referral code</Label>
                  <TextField
                    icon={<ShieldIcon className="h-[18px] w-[18px]" />}
                    value={referral}
                    onChange={(v) => {
                      setReferral(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12));
                      if (errors.referral) resetErrors();
                    }}
                    placeholder="e.g. LUCKY2024"
                    invalid={!!errors.referral}
                  />
                  <ErrorText msg={errors.referral} />
                </div>
              )}

              {!isLogin && (
                <div className="anim-fade-up pt-0.5" style={delay()}>
                  <Checkbox
                    checked={terms}
                    onChange={(v) => {
                      setTerms(v);
                      if (errors.terms) resetErrors();
                    }}
                  >
                    I agree to the <span className="font-bold text-emerald-600">Terms of Service</span> and{" "}
                    <span className="font-bold text-emerald-600">Privacy Policy</span>, and confirm I am 18 or older.
                  </Checkbox>
                  <ErrorText msg={errors.terms} />
                </div>
              )}

              {errors._forgot && (
                <div className="anim-fade-up flex items-center gap-2 rounded-[12px] bg-[#e7f8ef] px-3 py-2 text-[11.5px] font-bold text-emerald-700">
                  <CheckIcon className="h-4 w-4 shrink-0" /> {errors._forgot}
                </div>
              )}

              <button onClick={submit} disabled={busy} className={`${btnPrimary} anim-fade-up sheen group`} style={delay()}>
                {busy ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                ) : (
                  <>
                    {isLogin ? "Log in" : "Create account"}
                    <span className="text-[15px] leading-none transition-transform duration-200 group-hover:translate-x-1">→</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* footer switch */}
          <p className="mt-5 text-center text-[12px] font-semibold text-slate-500">
            {isLogin ? "New to Luxytrades? " : "Already have an account? "}
            <button
              onClick={() => switchMode(isLogin ? "register" : "login")}
              className="font-extrabold text-emerald-600 active:opacity-70"
            >
              {isLogin ? "Create an account" : "Log in"}
            </button>
          </p>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-[10.5px] font-medium text-slate-400">
            <ShieldIcon check className="h-3.5 w-3.5 text-emerald-500" />
            Bank-grade encryption · Funds held in segregated accounts
          </div>
        </div>
      </div>

      <CountryPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        value={country}
        onSelect={(c) => {
          pickedManually.current = true;
          setGeo({ country: c, detected: true });
        }}
      />
    </div>
  );
}
