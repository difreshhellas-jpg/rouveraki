"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowser, supabaseConfigured } from "@/lib/supabase/browser";
import { DEV_BYPASS, DEV_STAFF } from "@/lib/dev-mode";
import { DEMO_MODE } from "@/lib/demo/config";
import { apiFetch } from "@/lib/api";

// Demo mode opens the owner screens like the local test bypass does, but is
// deliberately a separate flag: it has no server behind it to protect.
const OPEN = DEV_BYPASS || DEMO_MODE;

type AdminAuthValue = {
  ready: boolean;
  session: Session | null;
  email: string | null;
  supabase: SupabaseClient | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** fetch() with the staff access token attached. */
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
};

const Ctx = createContext<AdminAuthValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(
    () => (OPEN ? null : getSupabaseBrowser()),
    [],
  );
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(OPEN || !supabaseConfigured);

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setReady(true);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      if (!supabase) return "Supabase is not configured.";
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error?.message ?? null;
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, [supabase]);

  /**
   * Reads the token from Supabase on every call rather than closing over the
   * session, so a refreshed token is used immediately and a staff member mid
   * shift never gets a surprise 401.
   */
  const authFetch = useCallback(
    async (input: string, init: RequestInit = {}) => {
      const token = supabase
        ? (await supabase.auth.getSession()).data.session?.access_token
        : undefined;

      return apiFetch(input, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(init.body ? { "Content-Type": "application/json" } : {}),
        },
      });
    },
    [supabase],
  );

  const value = useMemo<AdminAuthValue>(
    () => ({
      ready,
      // In test mode there is no real session; a truthy placeholder keeps the
      // shell's "signed in?" checks working without special-casing each one.
      session: OPEN ? ({ user: DEV_STAFF } as unknown as Session) : session,
      email: OPEN ? DEV_STAFF.email : (session?.user.email ?? null),
      supabase,
      signIn,
      signOut,
      authFetch,
    }),
    [ready, session, supabase, signIn, signOut, authFetch],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminAuth(): AdminAuthValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAdminAuth must be used inside <AdminAuthProvider>");
  return ctx;
}
