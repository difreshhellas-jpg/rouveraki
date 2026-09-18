"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "./config";

let pending: Promise<SupabaseClient | null> | null = null;

/**
 * Loads `@supabase/supabase-js` on demand and returns a client.
 *
 * Used by the customer order-tracking page: realtime matters there, but not
 * before first paint, and the SDK is the single largest dependency in the
 * project. Deferring it keeps that page inside the performance budget while
 * still getting live updates a moment later.
 *
 * Resolves to null when Supabase is not configured.
 */
export function loadSupabaseBrowser(): Promise<SupabaseClient | null> {
  if (!supabaseConfigured) return Promise.resolve(null);

  pending ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // The tracking page is anonymous; never touch stored auth state here.
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      realtime: { params: { eventsPerSecond: 5 } },
    }),
  );

  return pending;
}
