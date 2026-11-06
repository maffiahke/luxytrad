/**
 * Messages inbox API — the feed backing the /messages screen (and the same
 * endpoint the Android "Messages" app polls). Uses the normal trader bearer
 * token; identity resolution on the server falls back to ?username= for the
 * native shell, but the web page always has the token.
 */
import { getToken, ApiRequestError } from "./trader";

export interface FeedMessage {
  id: string;
  title: string;
  body: string;
  read: boolean;
  at: string;
}

export async function getMessages(): Promise<FeedMessage[]> {
  const res = await fetch("/api/messages", {
    headers: { ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiRequestError(res.status, data?.error ?? `Request failed (${res.status})`);
  return (data?.messages ?? []) as FeedMessage[];
}

/** Marks every unread message read (stops the native notifications re-alerting). */
export async function markAllMessagesRead(): Promise<number> {
  const res = await fetch("/api/messages/read", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: "{}",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiRequestError(res.status, data?.error ?? `Request failed (${res.status})`);
  return (data?.marked as number) ?? 0;
}
