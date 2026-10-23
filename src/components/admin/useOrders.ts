"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAdminAuth } from "./AdminAuth";
import { DEV_BYPASS, DEV_POLL_MS } from "@/lib/dev-mode";
import { DEMO_MODE, DEMO_POLL_MS } from "@/lib/demo/config";
import { onDemoChange } from "@/lib/demo/store";
import type { OrderStatus } from "@/lib/order-status";

export type AdminOrderItem = {
  menu_item_id: number;
  name: string;
  name_en?: string | null;
  unit_price_cents: number;
  quantity: number;
  item_notes?: string;
  category?: string;
};

export type AdminOrder = {
  id: number;
  orderCode: string;
  status: OrderStatus;
  allowedNext: OrderStatus[];
  fulfillmentType: "delivery" | "pickup";
  customerName: string;
  customerPhone: string;
  customerAddress: string | null;
  deliveryZone: string | null;
  items: AdminOrderItem[];
  generalNotes: string | null;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  paymentMethod: string;
  paymentStatus: string | null;
  ageVerified: boolean;
  etaMinutes: number | null;
  etaConfirmedAt: string | null;
  lastReason: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Live order list for the admin and kitchen screens.
 *
 * Realtime is the trigger; the refetch is what produces the data. Reacting to
 * an event by re-reading the list (rather than patching state from the event
 * payload) means two staff members acting at once converge on the same truth.
 */
export function useOrders(view: "live" | "all" = "live") {
  const { authFetch, supabase, session } = useAdminAuth();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);

  /** Order codes seen so far — a code we have not seen is a genuinely new order. */
  const seen = useRef<Set<string>>(new Set());
  const [newArrival, setNewArrival] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await authFetch(`/api/admin/orders?view=${view}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { orders: AdminOrder[] };

      // Announce only orders that are waiting to be accepted — a status change
      // on an order already on screen is not an arrival.
      for (const o of data.orders) {
        if (!seen.current.has(o.orderCode)) {
          seen.current.add(o.orderCode);
          if (o.status === "PAID_AWAITING_ACCEPTANCE" && !loading) {
            setNewArrival(o.orderCode);
          }
        }
      }

      setOrders(data.orders);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "error");
    } finally {
      setLoading(false);
    }
  }, [authFetch, view, loading]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    if (!supabase || !session) return;

    const channel = supabase
      .channel("staff-orders", { config: { private: true } })
      .on("broadcast", { event: "staff_order_event" }, () => {
        void refresh();
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, session, refresh]);

  /**
   * Safety net, not the primary path: if the socket drops (tablet sleeps, wifi
   * blips) a kitchen must not silently stop receiving orders. 30s is slow
   * enough to be nearly free and fast enough to notice.
   *
   * In test mode there is no realtime at all, so this becomes the only way new
   * orders appear and runs much faster.
   */
  useEffect(() => {
    const every = DEMO_MODE ? DEMO_POLL_MS : DEV_BYPASS ? DEV_POLL_MS : 30_000;
    const id = window.setInterval(() => void refresh(), every);
    return () => window.clearInterval(id);
  }, [refresh]);

  // Demo: another tab (the customer's phone view) placed or changed an order.
  useEffect(() => {
    if (!DEMO_MODE) return;
    return onDemoChange(() => void refresh());
  }, [refresh]);

  return {
    orders,
    loading,
    error,
    live,
    refresh,
    newArrival,
    clearArrival: () => setNewArrival(null),
  };
}

/**
 * Short double beep via the Web Audio API — no audio file to ship, cache or
 * 404. Browsers block audio until the page has been interacted with, which is
 * why the admin screens show an "enable sound" control.
 */
export function useAlertSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [enabled, setEnabled] = useState(false);

  const enable = useCallback(() => {
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return;
      ctxRef.current ??= new Ctor();
      void ctxRef.current.resume();
      setEnabled(true);
    } catch {
      setEnabled(false);
    }
  }, []);

  const play = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state !== "running") return;
    const now = ctx.currentTime;
    for (const [i, freq] of [880, 1175].entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.18;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    }
  }, []);

  return { enabled, enable, play };
}
