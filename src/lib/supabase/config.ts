/**
 * Supabase env flags, deliberately in their own module with no import of
 * `@supabase/supabase-js`.
 *
 * Anything that only needs to *know whether* Supabase is configured imports
 * this; anything that needs a client imports `browser.ts` (eager, for the admin
 * screens) or `lazy.ts` (dynamic, for the customer tracking page, which must
 * not pay ~55 kB of SDK before first paint).
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
