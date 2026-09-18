import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdminConfigured = Boolean(url && serviceKey);

let client: SupabaseClient | null = null;

/**
 * Service-role client. Server-only — the `server-only` import above makes it a
 * build error to pull this into a client component, which is the mistake that
 * leaks a service key.
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!supabaseAdminConfigured) return null;
  if (client) return client;
  client = createClient(url!, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
