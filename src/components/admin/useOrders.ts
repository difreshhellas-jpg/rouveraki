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
 * New-order bell via the Web Audio API: no audio file to ship, cache or 404.
 *
 * Browsers block audio until the page has been tapped once, so the shop
 * screens call enable() from the first tap. After that:
 * - iPhone/iPad: the audio session is "transient" (a notification sound), so
 *   the bell plays over music instead of being silenced by it. The side
 *   switch must not be on silent.
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
      // "transient" = a notification sound: it plays on top of music from
      // another app (and turns it down for a moment) instead of being cut off
      // when the music starts, which is what "playback" did.
      if (nav.audioSession) nav.audioSession.type = "transient";
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
    // A restaurant service-desk bell, struck twice ("ding-ding"): inharmonic
    // partials with a fast strike and a long ring, each slightly detuned so it
    // shimmers like metal instead of sounding like a synth beep. Pitched at
    // G6, where tablet speakers are loudest and kitchen noise is thinnest.
    const PARTIALS: [number, number, number][] = [
      [1, 0.7, 1.6],
      [2.32, 0.3, 0.9],
      [4.25, 0.14, 0.45],
      [6.63, 0.07, 0.25],
    ];
    const strike = (t: number, vel: number) => {
      for (const [ratio, level, decay] of PARTIALS) {
        for (const det of [-1.5, 1.5]) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = 1568 * ratio;
          osc.detune.value = det;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(level * vel * 0.5, t + 0.004);
          g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
          osc.connect(g).connect(out);
          osc.start(t);
          osc.stop(t + decay + 0.05);
        }
      }
    };
    const now = ctx.currentTime + 0.02;
    strike(now, 1);
    strike(now + 0.32, 0.85);
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
