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

  // Coming back to the screen (tablet woke, tab switched back): fetch at once
  // instead of waiting for the next poll.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const clearArrival = useCallback(() => setNewArrival(null), []);

  return {
    orders,
    loading,
    error,
    live,
    refresh,
    newArrival,
    clearArrival,
  };
}

/**
 * New-order chime via the Web Audio API: no audio file to ship, cache or 404.
 *
 * Browsers block audio until the page has been tapped once, so the shop
 * screens call enable() from the first tap. After that:
 * - iPhone/iPad: the audio session is set to "playback", so the chime still
 *   sounds with the side switch on silent (Safari 17+).
 * - A sleeping tablet suspends the audio context; it is resumed when the page
 *   is visible again and before every chime, so sound never quietly stops.
 * - Android also vibrates.
 */
type AudioSessionNav = Navigator & { audioSession?: { type: string } };

export function useAlertSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const outRef = useRef<AudioNode | null>(null);
  const [enabled, setEnabled] = useState(false);

  const ensure = useCallback((): AudioContext | null => {
    if (ctxRef.current) return ctxRef.current;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      const nav = navigator as AudioSessionNav;
      if (nav.audioSession) nav.audioSession.type = "playback";
    } catch {
      /* older Safari: no audio session control */
    }
    const ctx = new Ctor({ latencyHint: "interactive" });
    // A compressor lets the chime be loud without clipping on tablet speakers.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(comp).connect(ctx.destination);
    ctxRef.current = ctx;
    outRef.current = master;
    return ctx;
  }, []);

  const enable = useCallback(() => {
    const ctx = ensure();
    if (!ctx) return;
    void ctx.resume().then(
      () => setEnabled(ctx.state === "running"),
      () => setEnabled(false),
    );
  }, [ensure]);

  // Back from sleep or another app: wake the audio context up again.
  useEffect(() => {
    const wake = () => {
      const ctx = ctxRef.current;
      if (document.visibilityState === "visible" && ctx && ctx.state !== "running") {
        void ctx.resume().then(() => setEnabled(ctx.state === "running"));
      }
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => {
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, []);

  useEffect(() => () => void ctxRef.current?.close(), []);

  const ring = useCallback((ctx: AudioContext) => {
    const out = outRef.current;
    if (!out) return;
    const now = ctx.currentTime + 0.02;
    // Three rising bell notes (E6, G#6, B6), each a sine plus a soft octave.
    [1318.5, 1661.2, 1975.5].forEach((freq, i) => {
      const start = now + i * 0.16;
      for (const [mult, level] of [[1, 0.55], [2, 0.12]] as const) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq * mult;
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(level, start + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
        osc.connect(g).connect(out);
        osc.start(start);
        osc.stop(start + 0.6);
      }
    });
  }, []);

  const play = useCallback(() => {
    try {
      navigator.vibrate?.([180, 90, 180]);
    } catch {
      /* not supported */
    }
    const ctx = ctxRef.current;
    if (!ctx) return;
    if (ctx.state === "running") ring(ctx);
    else void ctx.resume().then(() => ctx.state === "running" && ring(ctx), () => {});
  }, [ring]);

  return { enabled, enable, play };
}
