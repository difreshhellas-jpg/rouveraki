import "server-only";
import { after } from "next/server";
import { getSupabaseAdmin } from "./supabase/admin";
import type { OrderStatus } from "./order-status";

/**
 * Realtime fan-out (spec §4: "Supabase Realtime, no polling").
 *
 * Deliberately uses **broadcast channels**, not postgres_changes on the orders
 * table. Listening to postgres_changes would require an RLS policy letting the
 * anon key SELECT from `orders`, which hands every customer every other
 * customer's name, phone and address. Broadcast carries only what the recipient
 * is allowed to see.
 *
 * Two channels:
 *   order:<CODE>  — public. Knowing the (random, unguessable) order code is the
 *                   authorisation, exactly as on the tracking page itself.
 *   staff-orders  — private. Requires a staff JWT; see supabase/policies.sql.
 */

export const orderChannel = (orderCode: string) => `order:${orderCode}`;
export const STAFF_CHANNEL = "staff-orders";

export type OrderUpdatePayload = {
  orderCode: string;
  status: OrderStatus;
  etaMinutes: number | null;
  reason: string | null;
  updatedAt: string;
};

export type StaffOrderEventPayload = {
  type: "new_order" | "status_changed";
  orderId: number;
  orderCode: string;
  status: OrderStatus;
  totalAmount: string;
  fulfillmentType: string;
  createdAt: string;
};

/**
 * Publish one broadcast.
 *
 * Over HTTP, never a WebSocket. The first deployment subscribed a socket and
 * waited up to 5s for SUBSCRIBED before sending; on Vercel that failed every
 * time with "subscribe timeout", so the kitchen screen and the tracking page
 * silently fell back to their slow poll. A serverless function is not a
 * long-lived client, and Supabase's REST broadcast (httpSend) is the path it
 * provides for exactly this: one request, no handshake, ~250ms measured.
 */
async function send(
  channelName: string,
  event: string,
  payload: unknown,
  isPrivate: boolean,
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    // Not configured (local dev without Supabase). The tracking page falls back
    // to its slow refresh path, so this is a warning, never a failure.
    console.warn(`[realtime] skipped ${event} on ${channelName}: not configured`);
    return;
  }

  const channel = supabase.channel(channelName, {
    config: { private: isPrivate },
  });

  try {
    const res = await channel.httpSend(event, payload, { timeout: 5000 });
    if (!res.success) {
      console.error(
        `[realtime] failed to publish ${event} on ${channelName}: ${res.status} ${res.error}`,
      );
    }
  } catch (e) {
    // A realtime hiccup must never roll back an order that is already committed.
    console.error(`[realtime] failed to publish ${event} on ${channelName}`, e);
  } finally {
    await supabase.removeChannel(channel);
  }
}

/**
 * Run a publish without making the caller wait, and without losing it.
 *
 * Callers fire and forget, which is right: the customer's order must not wait
 * on a broadcast. But on serverless a fire-and-forget promise is frozen the
 * moment the response is sent. `after()` tells the platform to keep the
 * function alive until the promise settles.
 *
 * Outside a request (the verification scripts call the order service
 * directly) `after()` throws; the promise then simply runs to completion in
 * the long-lived process, which is what it did before.
 */
function inBackground(task: Promise<void>): void {
  try {
    after(task);
  } catch {
    void task;
  }
}

export const publishOrderUpdate = (payload: OrderUpdatePayload): void =>
  inBackground(send(orderChannel(payload.orderCode), "order_update", payload, false));

export const publishStaffEvent = (payload: StaffOrderEventPayload): void =>
  inBackground(send(STAFF_CHANNEL, "staff_order_event", payload, true));
