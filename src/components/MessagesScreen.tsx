/**
 * /messages inbox screen — rendered when the site is deep-linked at
 * https://luxytrades.vercel.app/messages, which is the default landing URL of
 * the Android "Messages" app. Styled after Google Messages: a lavender shell
 * with a white conversation sheet, colored sender avatars, dates + unread
 * count badges, and a full thread view per sender.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "./Toast";
import { ApiRequestError } from "../api/trader";
import { getMessages, markMessagesRead, type FeedMessage } from "../api/messages";

const POLL_MS = 3000;

/* ------------------------------ avatars ------------------------------ */

/**
 * Avatar background: a fixed hue for senders you'd recognise instantly
 * (matching the real M-Pesa yellow), a stable hashed hue for everyone else.
 */
const KNOWN_AVATAR_COLORS: Record<string, string> = {
  MPESA: "#F9C412",
  SAFARICOM: "#34A853",
  AIRTEL: "#E53935",
  BANK: "#1E88E5",
};

const PALETTE = ["#42A5F5", "#F9C412", "#EF5350", "#4CAF50", "#26A69A", "#7E57C2", "#FF7043", "#5C6BC0"];

function avatarColor(title: string): string {
  const known = KNOWN_AVATAR_COLORS[title.toUpperCase()];
  if (known) return known;
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

/** White contact silhouette, like Google Messages' default avatars. */
function PersonSilhouette() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-[58%] w-[58%]">
      <circle cx="12" cy="8" r="3.7" fill="#fff" />
      <path d="M12 13.4c-4.4 0-7.3 2.3-7.3 5.2v1.9h14.6v-1.9c0-2.9-2.9-5.2-7.3-5.2z" fill="#fff" />
    </svg>
  );
}

function Avatar({ title, className = "" }: { title: string; className?: string }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{ background: avatarColor(title) }}
    >
      <PersonSilhouette />
    </div>
  );
}

/* ------------------------------ time format ------------------------------ */

const nairobiDateTime = (iso: string): string => {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-GB", {
    timeZone: "Africa/Nairobi",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const date = d.toLocaleDateString("en-GB", {
    timeZone: "Africa/Nairobi",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${date}, ${time}`;
};

/** Conversation-list stamp: "Oct 7" (adding the year once it's not current). */
function listStamp(iso: string): string {
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString("en-US", { ...opts, timeZone: "Africa/Nairobi" });
}

/* ------------------------------ conversations ------------------------------ */

interface Conversation {
  title: string;
  latest: FeedMessage;
  unread: number;
  total: number;
}

function groupBySender(messages: FeedMessage[]): Conversation[] {
  const byTitle = new Map<string, Conversation>();
  for (const m of messages) {
    let convo = byTitle.get(m.title);
    if (!convo) {
      convo = { title: m.title, latest: m, unread: 0, total: 0 };
      byTitle.set(m.title, convo);
    }
    convo.total++;
    if (!m.read) convo.unread++;
    if (new Date(m.at).getTime() > new Date(convo.latest.at).getTime()) convo.latest = m;
  }
  return [...byTitle.values()].sort((a, b) => new Date(b.latest.at).getTime() - new Date(a.latest.at).getTime());
}

/* ------------------------------ the screen ------------------------------ */

type View = { kind: "list" } | { kind: "thread"; title: string };

export function MessagesScreen() {
  const toast = useToast();
  const [messages, setMessages] = useState<FeedMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: "list" });

  const load = useCallback(async () => {
    try {
      setMessages(await getMessages());
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiRequestError && err.status === 401
          ? "Session expired — tap back and sign in again."
          : "Could not load messages.",
      );
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const conversations = useMemo(() => groupBySender(messages ?? []), [messages]);
  const totalUnread = useMemo(() => (messages ?? []).filter((m) => !m.read).length, [messages]);
  const threaded = view.kind === "thread" ? (messages ?? []).filter((m) => m.title === view.title) : [];
  const threadView = view.kind === "thread" ? view : null;

  /** Opening a thread marks that sender's messages read (badges clear). */
  const openThread = async (title: string) => {
    setView({ kind: "thread", title });
    if ((messages ?? []).some((m) => m.title === title && !m.read)) {
      try {
        await markMessagesRead(title);
        await load();
      } catch {
        /* the badge refresh is cosmetic — polling recovers it */
      }
    }
  };

  const markAll = async () => {
    try {
      const marked = await markMessagesRead();
      await load();
      toast.success(marked > 0 ? "Marked as read" : "Nothing unread", marked > 0 ? "All conversations marked as read" : undefined);
    } catch (err) {
      toast.error("Could not mark messages read", err instanceof Error ? err.message : undefined);
    }
  };

  /* ------------------------------ thread view ------------------------------ */
  if (threadView) {
    return (
      <div className="mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-[#e9ecf8] shadow-xl">
        <header className="flex items-center gap-3 px-4 pb-4 pt-6">
          <button
            type="button"
            onClick={() => setView({ kind: "list" })}
            aria-label="Back to conversations"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 active:scale-95"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="h-6 w-6 stroke-[2.2] fill-none stroke-current">
              <path d="M19 12H5m0 0l6-6m-6 6l6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <Avatar title={threadView.title} className="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[17px] font-bold text-slate-900">{threadView.title}</h1>
          </div>
          <button
            type="button"
            onClick={markAll}
            className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-extrabold text-[#0b57d0] ring-1 ring-slate-200 active:scale-95"
          >
            Mark all read
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
          {threaded
            .slice()
            .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
            .map((m) => (
              <div key={m.id} className="anim-fade-up mb-3 flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-white px-4 py-2.5 shadow-[0_1px_2px_rgba(15,42,80,0.08),0_4px_12px_rgba(15,42,80,0.06)]">
                  <p className="whitespace-pre-wrap break-words text-[13.5px] font-medium leading-[1.5] text-slate-800">
                    {m.body}
                  </p>
                  <p className="mt-1 text-[10.5px] font-semibold text-slate-400">{nairobiDateTime(m.at)}</p>
                </div>
              </div>
            ))}
        </main>

        <div className="flex justify-center pb-1.5 pt-2">
          <div className="h-[5px] w-[134px] rounded-full bg-emerald-950/80" />
        </div>
      </div>
    );
  }

  /* ------------------------------ list view ------------------------------ */
  return (
    <div className="mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-[#e9ecf8] shadow-xl">
      {/* Header on the tinted shell, like the Google Messages home */}
      <header className="flex items-center gap-2.5 px-4 pb-3 pt-5">
        <button
          type="button"
          onClick={() => (window.location.href = "/")}
          aria-label="Back to Luxytrades"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600 active:scale-95"
        >
          <svg viewBox="0 0 24 24" aria-hidden className="h-6 w-6 stroke-[2.2] fill-none stroke-current">
            <path d="M19 12H5m0 0l6-6m-6 6l6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[22px] font-bold">
          <span style={{ color: "#4285F4" }}>Lux</span>
          <span style={{ color: "#EA4335" }}>yt</span>
          <span style={{ color: "#F9AB00" }}>ra</span>
          <span style={{ color: "#34A853" }}>des</span>
          <span className="text-slate-700"> Messages</span>
        </h1>
        {totalUnread > 0 && (
          <button
            type="button"
            onClick={markAll}
            aria-label="Mark all read"
            className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-white px-3 text-[11px] font-extrabold text-[#0b57d0] shadow-sm active:scale-95"
          >
            Mark all ({totalUnread})
          </button>
        )}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(160deg,#1fc47d,#0b8a4c)] text-[13px] font-extrabold text-white shadow-sm">
          L
        </div>
      </header>

      {/* White conversation sheet */}
      <main className="min-h-0 flex-1 overflow-hidden rounded-t-[28px] bg-white shadow-[0_-6px_18px_rgba(15,42,80,0.10)]">
        <div className="h-full overflow-y-auto px-4 pb-8 pt-3">
          {messages === null && !error && (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 px-1 py-3">
                  <div className="h-[52px] w-[52px] animate-pulse rounded-full bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
                    <div className="h-3.5 w-44 animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="anim-fade-up mt-6 rounded-2xl bg-slate-50 p-5 text-center">
              <p className="text-[13px] font-bold text-slate-600">{error}</p>
            </div>
          )}

          {messages !== null && messages.length === 0 && !error && (
            <div className="anim-fade-up mt-10 p-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#F9C412]">
                <svg viewBox="0 0 24 24" aria-hidden className="h-8 w-8 opacity-90">
                  <circle cx="12" cy="8" r="3.7" fill="#fff" />
                  <path d="M12 13.4c-4.4 0-7.3 2.3-7.3 5.2v1.9h14.6v-1.9c0-2.9-2.9-5.2-7.3-5.2z" fill="#fff" />
                </svg>
              </div>
              <p className="mt-3 text-[14px] font-bold text-slate-700">No messages yet</p>
              <p className="mt-1 text-[12px] font-medium text-slate-400">
                M-Pesa payout receipts will appear here and buzz your phone instantly.
              </p>
            </div>
          )}

          {conversations.map((convo, i) => (
            <button
              key={convo.title}
              type="button"
              onClick={() => void openThread(convo.title)}
              className="anim-fade-up flex w-full items-center gap-3.5 px-1 py-3.5 text-left transition-colors active:bg-slate-50"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            >
              <Avatar title={convo.title} className="h-[52px] w-[52px]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-bold text-slate-900">{convo.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[13.5px] font-medium leading-[1.4] text-slate-600">
                  {convo.latest.body}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5 self-start pt-1">
                <span className="text-[12px] font-semibold text-slate-500">{listStamp(convo.latest.at)}</span>
                {convo.unread > 0 && (
                  <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-[#0b57d0] px-1.5 text-[11px] font-bold text-white shadow-sm">
                    {convo.unread}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </main>

      {/* iOS home indicator */}
      <div className="flex justify-center bg-[#e9ecf8] pb-1.5 pt-2">
        <div className="h-[5px] w-[134px] rounded-full bg-emerald-950/80" />
      </div>
    </div>
  );
}
