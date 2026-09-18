"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from "./config";

export { supabaseConfigured } from "./config";

let client: SupabaseClient | null = null;

export const clientOptions = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  realtime: { params: { eventsPerSecond: 5 } },
} as const;

/**
 * Eagerly-bundled browser client, used by the admin screens where Supabase Auth
 * is needed before anything can render anyway.
 *
 * Customer-facing pages should use `lazy.ts` instead, so the SDK does not land
 * in their first-load bundle.
 *
 * Returns null when Supabase is not configured, so every caller has to handle
 * the degraded path explicitly rather than crashing the page.
 */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY, clientOptions);
  return client;
}
