import "server-only";
import { kvGet, kvSet } from "@/lib/kv";

/**
 * Is the shop's own app (the /demo-kitchen screen) open right now?
 *
 * While it is open and signed in, it calls POST /api/shop/heartbeat every 30 s
 * and this stores the time. The site takes orders (delivery and pickup) only
 * while that time is recent. Closing the app, a sleeping tablet, no wifi or a flat
 * battery all simply stop the heartbeat, so ordering closes on its own within
 * KITCHEN_TTL_SECONDS, and reopens on the first heartbeat after the app opens.
 */
const KEY = "kitchen:last-seen";
export const KITCHEN_TTL_SECONDS = Number(process.env.KITCHEN_TTL_SECONDS) || 150;

/** Order types that need the shop app to be open: all of them. With the app
 *  closed nobody would see the order, so the site takes no orders at all. */
export const NEEDS_KITCHEN: readonly ("delivery" | "pickup")[] = ["delivery", "pickup"];

export async function markKitchenAlive(): Promise<void> {
  await kvSet(KEY, Date.now(), KITCHEN_TTL_SECONDS * 2);
}

/** Fails closed: if the store cannot be read, delivery counts as closed. */
export async function isKitchenOnline(): Promise<boolean> {
  try {
    const at = await kvGet<number>(KEY);
    return typeof at === "number" && Date.now() - at < KITCHEN_TTL_SECONDS * 1000;
  } catch {
    return false;
  }
}
