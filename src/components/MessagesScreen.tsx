/**
 * /messages inbox screen — rendered when the site is deep-linked at
 * https://luxytrades.vercel.app/messages, which is the default landing URL of
 * the Android "Messages" app. Shows the same feed the shell polls for native
 * M-Pesa alerts, styled like the rest of the trader app (neumorphic / emerald).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { BellIcon, CheckIcon, ChevronLeftIcon } from "./icons";
import { useToast } from "./Toast";
import { ApiRequestError } from "../api/trader";
import { getMessages, markAllMessagesRead, type FeedMessage } from "../api/messages";

const POLL_MS = 3000;

/** Timestamps shown in Kenyan time, like the M-Pesa receipts themselves. */
const nairobiTime = (iso: string): string => {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-GB", {
    timeZone: "Africa/Nairobi",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const date = d
    .toLocaleDateString("en-GB", { timeZone: "Africa/Nairobi", day: "numeric", month: "2-digit", year: "2-digit" })
    .replace(/\//g, "/");
  return `${date} at ${time}`;
};

function relative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  return nairobiTime(iso).split(" at ")[0];
}

export function MessagesScreen() {
  const toast = useToast();
  const [messages, setMessages] = useState<FeedMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    try {
      setMessages(await getMessages());
      setError(null);
    } catch (err) {
      setError(err instanceof ApiRequestError && err.status === 401 ? "Session expired — tap back and sign in again." : "Could not load messages.");
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const unreadCount = useMemo(() => (messages ?? []).filter((m) => !m.read).length, [messages]);

  const markAll = async () => {
    if (marking || unreadCount === 0) return;
    setMarking(true);
    try {
      await markAllMessagesRead();
      await load();
      toast.success("Marked as read", "All messages marked as read");
    } catch (err) {
      toast.error("Could not mark messages read", err instanceof Error ? err.message : undefined);
    } finally {
      setMarking(false);
    }
  };

  return (
    <div className="mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-[#eef1f6] shadow-xl">
      {/* Header — back to the trading app + unread badge + mark all read */}
      <header className="flex items-center gap-2 px-4 pb-3 pt-5">
        <button
          type="button"
          onClick={() => (window.location.href = "/")}
          aria-label="Back to Luxytrades"
          className="neu-sm flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-white text-slate-500 active:scale-95"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[18px] font-extrabold text-slate-900">Messages</h1>
          <p className="text-[11px] font-semibold text-slate-400">
            {unreadCount > 0 ? `${unreadCount} unread` : "M-Pesa payout alerts"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAll}
            disabled={marking}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-[linear-gradient(160deg,#1fc47d,#0b8a4c)] px-3 py-2 text-[11px] font-extrabold text-white shadow-[0_6px_14px_rgba(11,128,70,0.32)] transition-transform active:scale-95 disabled:opacity-60"
          >
            <CheckIcon className="h-3.5 w-3.5" />
            {marking ? "Marking…" : "Mark all read"}
          </button>
        )}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {messages === null && !error && (
          <div className="mt-6 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="neu-sm h-[86px] animate-pulse rounded-[18px] bg-white" />
            ))}
          </div>
        )}

        {error && (
          <div className="neu-sm anim-fade-up mt-6 rounded-[18px] bg-white p-5 text-center">
            <BellIcon className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-2 text-[13px] font-bold text-slate-600">{error}</p>
          </div>
        )}

        {messages !== null && messages.length === 0 && !error && (
          <div className="neu-sm anim-fade-up mt-6 rounded-[18px] bg-white p-6 text-center">
            <BellIcon className="mx-auto h-7 w-7 text-emerald-500/60" />
            <p className="mt-2 text-[13px] font-bold text-slate-600">No messages yet</p>
            <p className="mt-1 text-[11px] font-semibold text-slate-400">
              M-Pesa payout receipts will appear here and buzz your phone instantly.
            </p>
          </div>
        )}

        {messages !== null && messages.length > 0 && (
          <ul className="space-y-2.5">
            {messages.map((m, i) => (
              <li
                key={m.id}
                className="neu-sm anim-fade-up flex items-start gap-3 rounded-[18px] bg-white p-3.5"
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    m.read ? "bg-slate-100 text-slate-300" : "bg-emerald-50 text-emerald-500"
                  }`}
                >
                  <BellIcon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13.5px] font-extrabold text-slate-900">{m.title}</span>
                    {!m.read && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />}
                    <span className="ml-auto shrink-0 pl-1 text-[10.5px] font-semibold text-slate-400">
                      {relative(m.at)}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-[12px] font-medium leading-[1.45] text-slate-600">
                    {m.body}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold text-slate-400">{nairobiTime(m.at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* iOS home indicator */}
      <div className="flex justify-center pb-1.5 pt-2">
        <div className="h-[5px] w-[134px] rounded-full bg-emerald-950/80" />
      </div>
    </div>
  );
}
