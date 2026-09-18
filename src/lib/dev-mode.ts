/**
 * ============================================================================
 *  ADMIN AUTH BYPASS — a deliberate hole in authentication.
 * ============================================================================
 *
 * Payments are NOT handled here. Mock payments are PAYMENT_MODE=mock, which is
 * a separate, production-grade switch (see lib/payments/index.ts). This flag
 * does one thing only:
 *
 *   1. /admin/* opens without logging in, as a fake staff user.
 *   2. ...and, because there is no Supabase in that setup, the order and
 *      kitchen screens poll instead of using realtime.
 *
 * Use it to drive the staff side before a Supabase project exists.
 *
 * It is gated twice on purpose. `NODE_ENV === "production"` alone disables it,
 * so a stray env var on the real deployment cannot open the admin panel — and
 * if both somehow line up, assertDevBypassSafe() throws at startup rather than
 * serving an unauthenticated admin.
 *
 * Both names are read because the same answer is needed on the server (the API
 * routes) and in the browser bundle (the admin shell), and only NEXT_PUBLIC_*
 * is inlined for the client.
 */

const flagSet =
  process.env.NEXT_PUBLIC_DEV_BYPASS === "true" ||
  process.env.DEV_BYPASS === "true";

const isProduction = process.env.NODE_ENV === "production";

/** True only in a non-production build with the flag explicitly set. */
export const DEV_BYPASS = flagSet && !isProduction;

/**
 * Called from instrumentation at startup. A production build that still carries
 * the flag is a misconfiguration serious enough to refuse to boot for.
 */
export function assertDevBypassSafe(): void {
  if (isProduction && flagSet) {
    throw new Error(
      "DEV_BYPASS / NEXT_PUBLIC_DEV_BYPASS is set in a production build. " +
        "This disables admin authentication entirely. " +
        "Remove it from the environment before deploying.",
    );
  }
}

/** The fake identity every admin action is attributed to in test mode. */
export const DEV_STAFF = {
  id: "dev-bypass-user",
  email: "dev@localhost",
  role: "admin",
} as const;

/** How often the admin and tracking screens re-read while realtime is absent. */
export const DEV_POLL_MS = 4000;
