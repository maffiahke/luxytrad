import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  CheckIcon,
  ChevronRightIcon,
  CrownIcon,
  ClockIcon,
  CopyIcon,
  DownloadIcon,
  PhoneIcon,
  ShieldIcon,
  UploadIcon,
} from "./icons";
import { ModalShell, Step, btnContinue, btnSecondary, fieldInput, fieldLabel } from "./Sheet";
import { useApp } from "../state/AppStore";
import type { CryptoAsset as ApiCryptoAsset } from "../api/trader";
import { initMpesaStk, getMpesaStatus, type StkStatusResult } from "../api/payments";

export type FundMode = null | "choose" | "deposit" | "withdraw";

/* ---------------------------------- shell ---------------------------------- */

function MethodCard({
  onClick,
  badge,
  title,
  sub,
  Icon,
  tone,
}: {
  onClick: () => void;
  badge: string;
  title: string;
  sub: string;
  Icon: (p: { className?: string }) => ReactNode;
  tone: "green" | "blue";
}) {
  const color = tone === "green" ? "text-emerald-600" : "text-sky-600";
  const bg = tone === "green" ? "bg-[#e7f8ef]" : "bg-[#e8f2fd]";
  return (
    <button
      onClick={onClick}
      className="neu flex w-full items-center gap-3 rounded-[18px] bg-white p-3 text-left active:scale-[0.98]"
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${bg} ${color}`}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-extrabold text-slate-900">{title}</span>
        <span className="block truncate text-[10.5px] font-medium text-slate-500">{sub}</span>
      </span>
      <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ${bg} ${color}`}>{badge}</span>
      <ChevronRightIcon className={`h-4 w-4 shrink-0 ${color}`} />
    </button>
  );
}

function SuccessStep({ title, sub, icon }: { title: string; sub: string; icon: ReactNode }) {
  return (
    <Step>
      <div className="flex flex-col items-center px-2 py-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#e7f8ef] text-emerald-600 animate-[pop-in_0.35s_cubic-bezier(.22,1.4,.36,1)]">
          {icon}
        </span>
        <h4 className="mt-2.5 text-[15px] font-extrabold text-slate-900">{title}</h4>
        <p className="mt-1 text-[11.5px] font-medium leading-relaxed text-slate-500">{sub}</p>
      </div>
    </Step>
  );
}

function Spinner({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center py-6 text-center">
      <span className="relative flex h-14 w-14 items-center justify-center" style={{ animation: "pulse-ring 1.6s ease-out infinite" }}>
        <span className="absolute inset-0 rounded-full bg-[#e7f8ef]" />
        <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-emerald-200 border-t-emerald-600" />
      </span>
      <p className="mt-2.5 text-[12px] font-extrabold text-slate-800">{label}</p>
      {sub && <p className="mt-0.5 text-[11.5px] font-medium text-slate-500">{sub}</p>}
    </div>
  );
}

/* ------------------------------- amount controls ------------------------------ */

const DEPOSIT_PRESETS = [10, 100, 500, 1000] as const;

/** default fallback only for the KES caption when the server hasn't reported a rate */
const KES_RATE = 129.4;

const formatKes = (usd: number, rate = KES_RATE) => "KES " + Math.round(usd * rate).toLocaleString("en-US");

function AmountField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <>
      <label className={fieldLabel}>{label}</label>
      <div className="neu-sm flex items-center gap-1.5 rounded-[16px] bg-white px-3.5 py-2">
        <span className="text-[17px] font-extrabold text-slate-400">$</span>
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
          placeholder="0"
          className="min-w-0 flex-1 bg-transparent text-[21px] font-extrabold tracking-tight text-slate-900 outline-none placeholder:text-slate-300"
        />
        <span className="shrink-0 rounded-full bg-[#e7f8ef] px-2 py-0.5 text-[9px] font-extrabold tracking-wide text-emerald-700">USD</span>
      </div>
    </>
  );
}

function AmountChips({
  value,
  onPick,
  caption,
  emphasize,
  hint,
}: {
  value: number;
  onPick: (a: number) => void;
  caption?: (a: number) => string;
  emphasize?: (a: number) => boolean;
  hint?: ReactNode;
}) {
  return (
    <>
      <div className="mb-1.5 mt-3 flex items-center justify-between">
        <span className="text-[11.5px] font-bold text-slate-600">Quick select</span>
        {hint}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {DEPOSIT_PRESETS.map((a) => {
          const active = value === a;
          return (
            <button
              key={a}
              onClick={() => onPick(a)}
              aria-pressed={active}
              className={`rounded-[14px] px-1 py-2 text-center transition-all active:scale-95 ${
                active
                  ? "bg-[linear-gradient(160deg,#10b981,#047857)] text-white shadow-[0_8px_16px_rgba(16,122,74,0.35)]"
                  : "neu-sm bg-white text-slate-700"
              }`}
            >
              <span className="block text-[12.5px] font-extrabold leading-tight tracking-tight">
                {"$" + a.toLocaleString("en-US")}
              </span>
              {caption && (
                <span
                  className={`block text-[8px] font-bold leading-tight ${
                    active ? "text-emerald-50" : emphasize?.(a) ? "text-emerald-600" : "text-slate-400"
                  }`}
                >
                  {caption(a)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

function KesRow({ usd, action, rate = KES_RATE }: { usd: number; action: "pay" | "receive"; rate?: number }) {
  if (usd <= 0) return null;
  return (
    <div className="mt-2 flex items-center justify-between gap-2 rounded-[12px] bg-[#e7f8ef] px-3 py-1.5">
      <span className="text-[10.5px] font-extrabold text-emerald-700">
        {action === "pay" ? "You pay" : "You receive"} ≈ {formatKes(usd, rate)}
      </span>
      <span className="shrink-0 text-[9px] font-bold text-emerald-600/70">1 USD = {rate} KES</span>
    </div>
  );
}

/* -------------------------------- crypto gate ------------------------------- */

/** a crypto funding asset as configured in the admin Gateways console. */
type CryptoAsset = { sym: string; net: string; addr: string; min: number; max: number; confirmations: number };

/** placeholder so the crypto screens have an object to render before one is picked;
 *  the crypto method card is only reachable when at least one real asset exists. */
const EMPTY_ASSET: CryptoAsset = { sym: "", net: "", addr: "", min: 0, max: 0, confirmations: 0 };

const toAsset = (a: ApiCryptoAsset): CryptoAsset => ({
  sym: a.sym,
  net: a.net,
  addr: a.addr,
  min: a.min,
  max: a.max,
  confirmations: a.confirmations,
});

const limitHint = (a: CryptoAsset) =>
  `Min $${a.min.toLocaleString("en-US")} · Max $${a.max.toLocaleString("en-US")}`;

const assetChip = (active: boolean) =>
  `rounded-[14px] px-2 py-2.5 text-center transition-all ${
    active
      ? "bg-sky-600 text-white shadow-[0_6px_14px_rgba(2,110,197,0.35)]"
      : "neu-sm bg-white text-slate-700"
  }`;

function AssetPicker({ assets, asset, setAsset }: { assets: CryptoAsset[]; asset: CryptoAsset; setAsset: (a: CryptoAsset) => void }) {
  return (
    <>
      <label className="mb-1 block text-[11.5px] font-bold text-slate-600">Asset & network</label>
      <div className="grid grid-cols-3 gap-2">
        {assets.map((a) => (
          <button key={a.sym} onClick={() => setAsset(a)} className={assetChip(asset.sym === a.sym)}>
            <span className="block text-[12.5px] font-extrabold">{a.sym}</span>
            <span className={`block text-[9.5px] font-bold ${asset.sym === a.sym ? "text-sky-100" : "text-slate-400"}`}>
              {a.net}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

/* ------------------------------- deposit flow ------------------------------- */

function DepositModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { gateways, deposit, refresh } = useApp();

  const [method, setMethod] = useState<"pick" | "mpesa" | "crypto">("pick");
  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("+254 ");
  const [asset, setAsset] = useState<CryptoAsset>(EMPTY_ASSET);
  const [copied, setCopied] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // real STK push state
  const [liveCheckout, setLiveCheckout] = useState<string | null>(null);
  const [stkError, setStkError] = useState<string | null>(null);
  const [initiating, setInitiating] = useState(false);
  const [busy, setBusy] = useState(false);

  const mpesa = gateways?.mpesa;
  const kesRate = mpesa?.kesRate ?? KES_RATE;
  const assets: CryptoAsset[] = (gateways?.crypto.assets ?? []).map(toAsset);
  const cryptoAvailable = assets.length > 0;

  useEffect(() => {
    if (open) return;
    setMethod("pick");
    setStep(0);
    setAmount("");
    setAsset(assets[0] ?? EMPTY_ASSET);
    setShot(null);
    setCopied(false);
    setLiveCheckout(null);
    setStkError(null);
    setInitiating(false);
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => () => { copyTimer.current && clearTimeout(copyTimer.current); }, []);

  const copyAddr = async () => {
    try { await navigator.clipboard.writeText(asset.addr); } catch { /* clipboard unavailable */ }
    setCopied(true);
    copyTimer.current = setTimeout(() => setCopied(false), 1600);
  };

  const title = method === "pick" ? "Deposit Funds" : method === "mpesa" ? "Deposit via M-PESA" : "Deposit Crypto";
  const subtitle =
    method === "mpesa" && step === 1
      ? "Approve the STK prompt on your phone"
      : method === "crypto" && step === 1
        ? "Upload payment screenshot for approval"
        : undefined;

  const numericAmount = Number(amount) || 0;
  const isBonus = numericAmount >= 100;
  const credited = numericAmount * (isBonus ? 2 : 1);
  const cryptoInRange = numericAmount >= asset.min && numericAmount <= asset.max;

  // kick off a real Safaricom STK push. There is no offline fallback — if the
  // server's gateway isn't configured or is unreachable we surface the reason.
  const startMpesa = async () => {
    if (numericAmount <= 0 || initiating) return;
    setStkError(null);
    setInitiating(true);
    const res = await initMpesaStk({ phone, amountUsd: numericAmount });
    setInitiating(false);
    if (res.ok) {
      setLiveCheckout(res.checkoutRequestId);
      setStep(1);
      return;
    }
    if (!res.configured) {
      setStkError("M-Pesa deposits are unavailable right now. Please try another method or check back later.");
      return;
    }
    setStkError(res.error);
  };

  // while a real checkout is pending, poll until Safaricom confirms. On success we
  // only re-pull the server state — the /callback route has already credited it.
  useEffect(() => {
    if (!(open && method === "mpesa" && step === 1 && liveCheckout)) return;
    let cancelled = false;
    const startedAt = Date.now();
    const poll = async () => {
      const s: StkStatusResult | null = await getMpesaStatus(liveCheckout!);
      if (cancelled) return;
      if (!s) return; // transient network blip — keep polling
      if (s.status === "SUCCESS") {
        await refresh();
        if (cancelled) return;
        setLiveCheckout(null);
        setStep(2);
      } else if (s.status === "FAILED" || s.status === "EXPIRED") {
        setStkError(s.resultDesc || "Payment was not completed on your phone.");
        setLiveCheckout(null);
        setStep(0);
      } else if (Date.now() - startedAt > 120000) {
        setStkError("Timed out waiting for confirmation. Please try again.");
        setLiveCheckout(null);
        setStep(0);
      }
    };
    const id = setInterval(poll, 3000);
    poll();
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, method, step, liveCheckout]);

  // crypto deposit: creates a PENDING record on the server (credited only when
  // finance approves it) — no local crediting.
  const submitCrypto = async () => {
    if (busy || !cryptoInRange || numericAmount <= 0) return;
    setBusy(true);
    const ok = await deposit({
      channel: "CRYPTO",
      amount: numericAmount,
      bonusPct: isBonus ? 100 : 0,
      reference: `${asset.sym} ${asset.net}`.trim(),
    });
    setBusy(false);
    if (ok) setStep(2);
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      onBack={method !== "pick" && step === 0 ? () => setMethod("pick") : undefined}
      title={title}
      subtitle={subtitle}
    >
      {method === "pick" && (
        <Step>
          <div className="space-y-2.5 py-1">
            <MethodCard
              tone="green"
              badge="STK"
              title="M-PESA"
              sub="Instant deposit via STK push"
              Icon={PhoneIcon}
              onClick={() => { setMethod("mpesa"); setStep(0); }}
            />
            {cryptoAvailable && (
              <MethodCard
                tone="blue"
                badge="Address"
                title="Crypto"
                sub="Send to wallet address, approve via screenshot"
                Icon={ShieldIcon}
                onClick={() => { setAsset(assets[0] ?? EMPTY_ASSET); setMethod("crypto"); setStep(0); }}
              />
            )}
          </div>
        </Step>
      )}

      {method === "mpesa" && step === 0 && (
        <Step>
          <div className="py-1">
            <AmountField label="Amount to deposit" value={amount} onChange={setAmount} />
            <AmountChips
              value={numericAmount}
              onPick={(a) => setAmount(String(a))}
              caption={(a) => (a >= 100 ? "100% bonus" : "starter")}
              emphasize={(a) => a >= 100}
              hint={
                <span className="inline-flex items-center gap-1 text-[9.5px] font-extrabold text-emerald-600">
                  <CrownIcon className="h-3 w-3" /> 100% bonus on $100+
                </span>
              }
            />
            <KesRow usd={numericAmount} action="pay" rate={kesRate} />

            <div
              className={`mt-2.5 flex items-center gap-2.5 rounded-[16px] px-3 py-2.5 transition-colors ${
                isBonus
                  ? "bg-[linear-gradient(105deg,#0b4d31,#11703f)] shadow-[0_8px_18px_rgba(6,48,31,0.25)]"
                  : "neu-sm bg-white"
              }`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isBonus ? "bg-white/15" : "bg-[#e7f8ef]"}`}>
                <CrownIcon className={`h-4 w-4 ${isBonus ? "text-[#f7c948]" : "text-emerald-600"}`} />
              </span>
              <div className="min-w-0 flex-1">
                <div className={`text-[11px] font-extrabold ${isBonus ? "text-white" : "text-slate-800"}`}>
                  {isBonus ? "100% bonus unlocked" : numericAmount > 0 ? "Bonus available" : "Double your deposit"}
                </div>
                <div className={`text-[10px] font-semibold leading-snug ${isBonus ? "text-emerald-100" : "text-slate-500"}`}>
                  {isBonus
                    ? `Pay $${numericAmount.toLocaleString("en-US")} → trade with $${credited.toLocaleString("en-US")}`
                    : numericAmount > 0 && numericAmount < 100
                      ? `Add $${(100 - numericAmount).toLocaleString("en-US")} more to unlock the 100% bonus.`
                      : "Deposit $100, $500 or $1,000 and we match it — up to $1,000 free."}
                </div>
              </div>
            </div>

            <label className={`${fieldLabel} mt-3`}>M-PESA phone number</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+254 7XX XXX XXX"
              className={fieldInput}
            />
            <div className="mt-2 flex items-center justify-center gap-1.5 rounded-[12px] bg-[#e7f8ef] px-3 py-2 text-center text-[10.5px] font-semibold text-emerald-700">
              <ShieldIcon className="h-3.5 w-3.5 shrink-0" />
              You will receive an STK push prompt to enter your M-PESA PIN.
            </div>
            {!mpesa?.enabled && (
              <div className="mt-2 rounded-[12px] bg-amber-50 px-3 py-2 text-center text-[10.5px] font-semibold text-amber-700">
                M-Pesa deposits are currently disabled. Please use Crypto or try again later.
              </div>
            )}
            {stkError && (
              <div className="mt-2 rounded-[12px] bg-rose-50 px-3 py-2 text-center text-[10.5px] font-bold text-rose-600">
                {stkError}
              </div>
            )}
            <button
              disabled={numericAmount <= 0 || initiating || !mpesa?.enabled}
              onClick={startMpesa}
              className={`${btnContinue} disabled:opacity-40`}
            >
              {initiating
                ? "Sending STK prompt…"
                : isBonus
                ? `Pay $${numericAmount.toLocaleString("en-US")} · get $${credited.toLocaleString("en-US")}`
                : `Deposit $${numericAmount > 0 ? numericAmount.toLocaleString("en-US") : "0"}`}
            </button>
          </div>
        </Step>
      )}

      {method === "mpesa" && step === 1 && (
        <Step>
          <Spinner
            label={`STK push sent to ${phone || "+254 7•• ••• •••"}`}
            sub={`Enter your M-PESA PIN on your phone to approve ${formatKes(numericAmount, kesRate)}.`}
          />
          <p className="-mt-2 text-center text-[10.5px] font-semibold text-emerald-600">Waiting for Safaricom confirmation…</p>
          <button
            onClick={() => { setLiveCheckout(null); setStkError("Deposit cancelled."); setStep(0); }}
            className={`${btnSecondary} mt-4`}
          >
            Cancel
          </button>
        </Step>
      )}

      {method === "mpesa" && step === 2 && (
        <SuccessStep
          icon={<CheckIcon className="h-7 w-7" />}
          title="Deposit Successful"
          sub={
            isBonus
              ? `$${numericAmount.toLocaleString("en-US")} deposited — your $${credited.toLocaleString("en-US")} balance is ready to trade, including the 100% bonus.`
              : `$${numericAmount.toLocaleString("en-US")} has been added to your trading balance via M-PESA. You can start trading right away.`
          }
        />
      )}

      {method === "crypto" && step === 0 && (
        <Step>
          <div className="py-1">
            <AssetPicker assets={assets} asset={asset} setAsset={setAsset} />
            <label className={`${fieldLabel} mt-3`}>Send only {asset.sym} ({asset.net}) to:</label>
            <div className="flex items-center gap-2">
              <div className="neu-sm min-w-0 flex-1 truncate rounded-[14px] bg-white px-3 py-2.5 text-[10.5px] font-bold text-slate-800">
                {asset.addr}
              </div>
              <button
                onClick={copyAddr}
                className={`flex shrink-0 items-center gap-1.5 rounded-[14px] px-3 py-2.5 text-[11px] font-extrabold text-white transition-all ${
                  copied ? "bg-emerald-600" : "bg-sky-600 active:scale-95"
                }`}
              >
                {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2 rounded-[12px] bg-[#e7f8ef] px-3 py-2 text-[10.5px] font-semibold leading-snug text-emerald-700">
              <ShieldIcon className="h-3.5 w-3.5 shrink-0" />
              Credits confirm after {asset.confirmations} network confirmation{asset.confirmations === 1 ? "" : "s"} — usually a few minutes.
            </div>
            <div className="mt-3">
              <AmountField label="Amount you are sending (USD)" value={amount} onChange={setAmount} />
              <AmountChips
                value={numericAmount}
                onPick={(a) => setAmount(String(a))}
                caption={(a) => (a >= 100 ? "100% bonus" : "starter")}
                emphasize={(a) => a >= 100}
                hint={
                  <span className="inline-flex items-center gap-1 text-[9.5px] font-extrabold text-emerald-600">
                    <CrownIcon className="h-3 w-3" /> 100% bonus on $100+
                  </span>
                }
              />
              <p className="mt-1.5 text-center text-[10px] font-bold text-slate-400">{limitHint(asset)}</p>
            </div>
            <button
              disabled={!cryptoInRange}
              onClick={() => setStep(1)}
              className={`${btnContinue} disabled:opacity-40`}
            >
              I have sent the funds
            </button>
            <button onClick={() => setStep(0)} className={btnSecondary}>
              Back
            </button>
          </div>
        </Step>
      )}

      {method === "crypto" && step === 1 && (
        <Step>
          <div className="py-1">
            <div className="neu-sm flex flex-col items-center gap-2 rounded-[16px] bg-white p-4 text-center">
              {shot ? (
                <img src={shot} alt="Payment screenshot preview" className="max-h-32 rounded-xl object-cover" />
              ) : (
                <button onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-1 text-sky-600">
                  <UploadIcon className="h-7 w-7" />
                  <span className="text-[12px] font-bold">Tap to upload screenshot</span>
                  <span className="text-[10px] font-medium text-slate-400">PNG or JPG showing the sent transaction</span>
                </button>
              )}
              {shot && (
                <button onClick={() => fileRef.current?.click()} className="text-[11px] font-bold text-sky-600 underline">
                  Replace screenshot
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setShot(URL.createObjectURL(f));
                }}
              />
            </div>
            <p className="mt-2 text-center text-[10.5px] font-medium text-slate-500">
              Sending ${numericAmount.toLocaleString("en-US")} worth of {asset.sym}. Our finance desk verifies and credits your balance.
            </p>
            <button onClick={submitCrypto} disabled={busy} className={`${btnContinue} disabled:opacity-40`}>
              {busy ? "Submitting…" : "Submit for approval"}
            </button>
            <button onClick={() => setStep(0)} className={btnSecondary}>
              Back
            </button>
          </div>
        </Step>
      )}

      {method === "crypto" && step === 2 && (
        <SuccessStep
          icon={<ClockIcon className="h-7 w-7" />}
          title="Pending Approval"
          sub={
            numericAmount > 0
              ? `We received your $${numericAmount.toLocaleString("en-US")} screenshot and are verifying the transaction — deposits are usually approved within 10–30 minutes and credited automatically.`
              : "We received your screenshot and are verifying the transaction — deposits are usually approved within 10–30 minutes and credited automatically."
          }
        />
      )}
    </ModalShell>
  );
}

/* ------------------------------- withdraw flow ------------------------------ */

function WithdrawModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { gateways, withdraw } = useApp();

  const [method, setMethod] = useState<"pick" | "mpesa" | "crypto">("pick");
  const [step, setStep] = useState(0);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("+254 ");
  const [wallet, setWallet] = useState("");
  const [asset, setAsset] = useState<CryptoAsset>(EMPTY_ASSET);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const kesRate = gateways?.mpesa?.kesRate ?? KES_RATE;
  const assets: CryptoAsset[] = (gateways?.crypto.assets ?? []).map(toAsset);
  const cryptoAvailable = assets.length > 0;

  useEffect(() => {
    if (!open) {
      setMethod("pick");
      setStep(0);
      setAmount("");
      setWallet("");
      setAsset(assets[0] ?? EMPTY_ASSET);
      setBusy(false);
      setErr(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const title = method === "pick" ? "Withdraw Funds" : method === "mpesa" ? "Withdraw via M-PESA" : "Withdraw Crypto";
  const numericAmount = Number(amount) || 0;
  const cryptoInRange = numericAmount >= asset.min && numericAmount <= asset.max;

  // the server debits the balance and queues the request for finance; on failure
  // AppStore surfaces the reason as a toast and we stay on the form.
  const submit = async () => {
    if (busy || numericAmount <= 0) return;
    setErr(null);
    setBusy(true);
    const ok = await withdraw({
      channel: method === "mpesa" ? "MPESA" : "CRYPTO",
      amount: numericAmount,
      fee: 0,
      destination: method === "mpesa" ? phone || "M-PESA" : wallet || asset.addr,
    });
    setBusy(false);
    if (ok) setStep(2);
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      onBack={method !== "pick" && step === 0 ? () => setMethod("pick") : undefined}
      title={title}
    >
      {method === "pick" && (
        <Step>
          <div className="space-y-2.5 py-1">
            <MethodCard
              tone="green"
              badge="Mobile"
              title="M-PESA"
              sub="Withdraw to your Safaricom number"
              Icon={PhoneIcon}
              onClick={() => { setMethod("mpesa"); setStep(0); setErr(null); }}
            />
            {cryptoAvailable && (
              <MethodCard
                tone="blue"
                badge="Wallet"
                title="Crypto"
                sub="Send to an external wallet address"
                Icon={ShieldIcon}
                onClick={() => { setAsset(assets[0] ?? EMPTY_ASSET); setMethod("crypto"); setStep(0); setErr(null); }}
              />
            )}
          </div>
        </Step>
      )}

      {method === "mpesa" && step === 0 && (
        <Step>
          <div className="py-1">
            <AmountField label="Amount to withdraw" value={amount} onChange={setAmount} />
            <AmountChips value={numericAmount} onPick={(a) => setAmount(String(a))} caption={() => "processed"} />
            <KesRow usd={numericAmount} action="receive" rate={kesRate} />
            <label className={`${fieldLabel} mt-2.5`}>M-PESA phone number</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+254 7XX XXX XXX"
              className={fieldInput}
            />
            {err && (
              <div className="mt-2 rounded-[12px] bg-rose-50 px-3 py-2 text-center text-[10.5px] font-bold text-rose-600">{err}</div>
            )}
            <button
              disabled={!amount || numericAmount <= 0 || busy}
              onClick={submit}
              className={`${btnContinue} disabled:opacity-40`}
            >
              {busy ? "Submitting…" : `Withdraw $${amount || "0"}`}
            </button>
          </div>
        </Step>
      )}

      {method === "mpesa" && step === 2 && (
        <SuccessStep
          icon={<CheckIcon className="h-7 w-7" />}
          title="Withdrawal Submitted"
          sub={`Your ${method === "mpesa" ? "M-PESA" : "crypto"} withdrawal request for $${amount || "0"} has been received. The finance team processes payouts shortly — you'll get an SMS confirmation once it clears.`}
        />
      )}

      {method === "crypto" && step === 0 && (
        <Step>
          <div className="py-1">
            <AssetPicker assets={assets} asset={asset} setAsset={setAsset} />
            <label className={`${fieldLabel} mt-3`}>Your {asset.sym} ({asset.net}) wallet address</label>
            <input
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder={`Paste your ${asset.net} address`}
              className={`${fieldInput} text-[11px]`}
            />
            <div className="mt-2.5">
              <AmountField label="Amount to withdraw" value={amount} onChange={setAmount} />
              <AmountChips value={numericAmount} onPick={(a) => setAmount(String(a))} caption={() => "processed"} />
              <p className="mt-1.5 text-center text-[10px] font-bold text-slate-400">{limitHint(asset)}</p>
            </div>
            {err && (
              <div className="mt-2 rounded-[12px] bg-rose-50 px-3 py-2 text-center text-[10.5px] font-bold text-rose-600">{err}</div>
            )}
            <button
              disabled={!wallet || !cryptoInRange || busy}
              onClick={submit}
              className={`${btnContinue} disabled:opacity-40`}
            >
              {busy ? "Submitting…" : `Withdraw $${amount || "0"}`}
            </button>
          </div>
        </Step>
      )}
    </ModalShell>
  );
}

/* ------------------------------- entry sheet -------------------------------- */

export function FundsModals({ mode, setMode }: { mode: FundMode; setMode: (m: FundMode) => void }) {
  return (
    <>
      <ModalShell
        open={mode === "choose"}
        onClose={() => setMode(null)}
        title="My Wallet"
        subtitle="What would you like to do?"
      >
        <Step>
          <div className="grid grid-cols-2 gap-2.5 pb-1 pt-1">
            <button
              onClick={() => setMode("deposit")}
              className="flex flex-col items-center gap-1.5 rounded-[18px] bg-emerald-600 py-5 text-white shadow-[0_8px_18px_rgba(16,122,74,0.35)] active:scale-[0.97]"
            >
              <DownloadIcon className="h-6 w-6" />
              <span className="text-[13px] font-extrabold">Deposit</span>
            </button>
            <button
              onClick={() => setMode("withdraw")}
              className="neu flex flex-col items-center gap-1.5 rounded-[18px] bg-white py-5 text-slate-800 active:scale-[0.97]"
            >
              <UploadIcon className="h-6 w-6 text-sky-600" />
              <span className="text-[13px] font-extrabold">Withdraw</span>
            </button>
          </div>
        </Step>
      </ModalShell>
      <DepositModal open={mode === "deposit"} onClose={() => setMode(null)} />
      <WithdrawModal open={mode === "withdraw"} onClose={() => setMode(null)} />
    </>
  );
}
