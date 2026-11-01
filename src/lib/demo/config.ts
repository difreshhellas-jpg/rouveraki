/**
 * THE demo switch. NEXT_PUBLIC_DEMO_MODE=true runs the whole ordering flow with
 * no server: menu from src/data/menu.json, orders in the browser's
 * localStorage, fake payment, /demo-kitchen as the shop-owner screen.
 *
 * Unset (or anything else) and the site uses the real backend as before.
 * NEXT_PUBLIC_* is inlined at build time, so flipping it needs a rebuild.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

/** How often demo screens re-read local orders (same-tab changes). */
export const DEMO_POLL_MS = 15_000;
