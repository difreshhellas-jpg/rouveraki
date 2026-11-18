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

/** The order-alert sounds (public/sounds), mastered loud for small speakers. */
export const ALERT_SOUNDS = [
  { id: "alarm", label: "Συναγερμός (πιο δυνατός)" },
  { id: "buzzer", label: "Βομβητής κουζίνας" },
  { id: "phone", label: "Κουδούνι τηλεφώνου" },
  { id: "bell", label: "Καμπανάκι" },
  { id: "chime", label: "Ντινγκ-ντονγκ" },
] as const;
export type AlertSoundId = (typeof ALERT_SOUNDS)[number]["id"];
const SOUND_STORE = "rouveraki.alert-sound";

const readChoice = (): { id: AlertSoundId; repeat: number } => {
  try {
    const v = JSON.parse(localStorage.getItem(SOUND_STORE) ?? "null");
    if (v && ALERT_SOUNDS.some((s) => s.id === v.id)) return { id: v.id, repeat: Math.min(3, Math.max(1, v.repeat | 0)) };
  } catch {
    /* default below */
  }
  return { id: "alarm", repeat: 2 };
};

/**
 * New-order alert: loud recorded sounds (public/sounds/*.wav, peak -1 dBFS)
 * played through Web Audio at full level, with no compressor in the way. The
 * old synthesized bell was soft sine tones squeezed by a compressor, which is
 * why it needed a 600% volume boost to be heard.
 *
 * Browsers block audio until the page has been tapped once, so the shop
 * screens call enable() from the first tap. After that:
 * - iPhone/iPad: the audio session is "transient" (a notification sound), so
 *   it plays over music instead of being silenced by it.
 * - A sleeping tablet suspends the audio context; it is resumed when the page
 *   is visible again and before every alert, so sound never quietly stops.
 * - Android also vibrates.
 * The chosen sound and how many times it plays per alert (1-3) are kept on
 * this device.
 */
type AudioSessionNav = Navigator & { audioSession?: { type: string } };

export function useAlertSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const buffers = useRef(new Map<string, Promise<AudioBuffer | null>>());
  const [enabled, setEnabled] = useState(false);
  const [choice, setChoiceState] = useState<{ id: AlertSoundId; repeat: number }>({ id: "alarm", repeat: 2 });
  useEffect(() => setChoiceState(readChoice()), []);

  const ensure = useCallback((): AudioContext | null => {
    if (ctxRef.current) return ctxRef.current;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      const nav = navigator as AudioSessionNav;
      if (nav.audioSession) nav.audioSession.type = "transient";
    } catch {
      /* older Safari: no audio session control */
    }
    ctxRef.current = new Ctor({ latencyHint: "interactive" });
    return ctxRef.current;
  }, []);

  const load = useCallback((ctx: AudioContext, id: string) => {
    let p = buffers.current.get(id);
    if (!p) {
      p = fetch(`/sounds/${id}.wav`)
        .then((r) => r.arrayBuffer())
        .then((b) => ctx.decodeAudioData(b))
        .catch(() => null);
      buffers.current.set(id, p);
    }
    return p;
  }, []);

  const enable = useCallback(() => {
    const ctx = ensure();
    if (!ctx) return;
    void load(ctx, readChoice().id);
    void ctx.resume().then(
      () => setEnabled(ctx.state === "running"),
      () => setEnabled(false),
    );
  }, [ensure, load]);

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

  const ring = useCallback(
    async (ctx: AudioContext, id: string, repeat: number) => {
      const buf = await load(ctx, id);
      if (!buf) return;
      let at = ctx.currentTime + 0.02;
      for (let i = 0; i < repeat; i++) {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(at);
        at += buf.duration + 0.15;
      }
    },
    [load],
  );

  const playWith = useCallback(
    (id: string, repeat: number) => {
      try {
        navigator.vibrate?.([300, 120, 300, 120, 300]);
      } catch {
        /* not supported */
      }
      const ctx = ctxRef.current ?? ensure();
      if (!ctx) return;
      if (ctx.state === "running") void ring(ctx, id, repeat);
      else
        void ctx.resume().then(
          () => {
            setEnabled(ctx.state === "running");
            if (ctx.state === "running") void ring(ctx, id, repeat);
          },
          () => {},
        );
    },
    [ensure, ring],
  );

  const play = useCallback(() => {
    const c = readChoice();
    playWith(c.id, c.repeat);
  }, [playWith]);

  /** Save a new sound / repeat choice on this device and play it once as a preview. */
  const setChoice = useCallback(
    (next: { id: AlertSoundId; repeat: number }) => {
      setChoiceState(next);
      try {
        localStorage.setItem(SOUND_STORE, JSON.stringify(next));
      } catch {
        /* private mode: lasts for this visit */
      }
      playWith(next.id, 1);
    },
    [playWith],
  );

  return { enabled, enable, play, choice, setChoice };
}
