import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, LIVE } from "./api";
import { useStoreVersion } from "../state/store";
import type { Session } from "./types";

interface AdminCtx {
  session: Session | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  live: boolean;
  /** bump to re-run every useResource loader after a mutation */
  revision: number;
  refresh: () => void;
}

const Ctx = createContext<AdminCtx | null>(null);

const KEY = "lx_admin_session";

export function AdminProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  });
  const [revision, setRevision] = useState(0);

  // In mock mode the admin shares the browser `db` with the trader app, so adopt
  // every store change (same-tab trader actions or a cross-tab `storage` event).
  const storeVersion = useStoreVersion();
  useEffect(() => {
    if (LIVE) return;
    setRevision((r) => r + 1);
  }, [storeVersion]);

  useEffect(() => {
    if (session) sessionStorage.setItem(KEY, JSON.stringify(session));
    else sessionStorage.removeItem(KEY);
  }, [session]);

  const signIn = useCallback(async (email: string, password: string) => {
    const s = await api.login(email, password);
    setSession(s);
  }, []);
  const signOut = useCallback(() => {
    setSession(null);
    sessionStorage.removeItem("lx_admin_token");
  }, []);
  const refresh = useCallback(() => setRevision((r) => r + 1), []);

  const value = useMemo<AdminCtx>(
    () => ({ session, signIn, signOut, live: LIVE, revision, refresh }),
    [session, signIn, signOut, revision, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdmin() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdmin must be used inside AdminProvider");
  return ctx;
}

/** generic async resource loader tied to the global revision for easy refresh */
export function useResource<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const { revision } = useAdmin();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    loader()
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e) => alive && setError(String(e?.message ?? e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, ...deps]);
  return { data, loading, error };
}
