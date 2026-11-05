"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { useI18n } from "@/i18n/LanguageProvider";
import { formatEuro } from "@/lib/money";
import { BRAND } from "@/lib/brand";
import {
  trackingSteps,
  isUnsuccessful,
  type OrderStatus,
} from "@/lib/order-status";
import { supabaseConfigured } from "@/lib/supabase/config";
import { loadSupabaseBrowser } from "@/lib/supabase/lazy";
import { DEV_BYPASS, DEV_POLL_MS } from "@/lib/dev-mode";
import { apiFetch } from "@/lib/api";
import EtaCountdown from "@/components/EtaCountdown";
import { DEMO_MODE, DEMO_POLL_MS } from "@/lib/demo/config";

export type TrackedOrder = {
  orderCode: string;
  status: OrderStatus;
  fulfillmentType: "delivery" | "pickup";
  etaMinutes: number | null;
  etaConfirmedAt: string | null;
  items: Array<{
    menu_item_id: number;
    name: string;
    name_en?: string | null;
    unit_price_cents: number;
    quantity: number;
    item_notes?: string;
  }>;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  paymentMethod: string;
  customerFirstName: string;
  createdAt: string;
  updatedAt: string;
  reason: string | null;
  cancellable: boolean;
  cancelWindowSecondsLeft: number;
};

export default function OrderTracker({ initial }: { initial: TrackedOrder }) {
  const { t, pick, locale } = useI18n();
  const [order, setOrder] = useState<TrackedOrder>(initial);
  const [live, setLive] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(initial.cancelWindowSecondsLeft);

  const money = (cents: number) =>
    formatEuro(cents / 100, locale === "en" ? "en-IE" : "el-GR");

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/orders/${order.orderCode}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { order: TrackedOrder };
      setOrder(data.order);
      setSecondsLeft(data.order.cancelWindowSecondsLeft);
    } catch {
      /* transient — the next event or tick will catch up */
    }
  }, [order.orderCode]);

  /* ---- realtime -------------------------------------------------------- */
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    // The SDK is loaded after first paint (see lib/supabase/lazy.ts), so this
    // effect is async and has to guard against unmounting mid-load.
    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void loadSupabaseBrowser().then((supabase) => {
      if (cancelled) return;

      if (!supabase) {
        // Fallback only. Realtime is the intended path (spec §4); this keeps
        // the page honest on a deployment without Supabase configured yet.
        pollRef.current = window.setInterval(
          refresh,
          DEMO_MODE ? DEMO_POLL_MS : DEV_BYPASS ? DEV_POLL_MS : 15_000,
        );
        cleanup = () => {
          if (pollRef.current) window.clearInterval(pollRef.current);
        };
        return;
      }

      const channel = supabase
        .channel(`order:${order.orderCode}`)
        .on("broadcast", { event: "order_update" }, ({ payload }) => {
          const p = payload as {
            status: OrderStatus;
            etaMinutes: number | null;
            reason: string | null;
          };
          setOrder((prev) => ({
            ...prev,
            status: p.status,
            etaMinutes: p.etaMinutes ?? prev.etaMinutes,
            reason: p.reason ?? prev.reason,
            // Once the shop has acted, self-cancellation is off the table.
            cancellable:
              p.status === "PAID_AWAITING_ACCEPTANCE" && prev.cancellable,
          }));
        })
        .subscribe((status) => setLive(status === "SUBSCRIBED"));

      cleanup = () => {
        setLive(false);
        void supabase.removeChannel(channel);
      };
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [order.orderCode, refresh]);

  /* ---- cancel window countdown ---------------------------------------- */
  useEffect(() => {
    if (!order.cancellable || secondsLeft <= 0) return;
    const id = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [order.cancellable, secondsLeft]);

  const cancel = async () => {
    setCancelling(true);
    try {
      const res = await apiFetch(`/api/orders/${order.orderCode}/cancel`, {
        method: "POST",
      });
      if (res.ok) await refresh();
    } finally {
      setCancelling(false);
    }
  };

  const steps = trackingSteps(order.fulfillmentType);
  const currentIndex = steps.indexOf(order.status);
  const failed = isUnsuccessful(order.status);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-char/55">
          {t("order.code")}
        </p>
        <h1 className="mt-1 font-display text-[clamp(2.25rem,9vw,3.5rem)] font-bold tabular-nums tracking-wider">
          {order.orderCode}
        </h1>
        {live && (
          <p className="mt-2 inline-flex items-center gap-2 text-sm text-char/60">
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500">
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-emerald-500 motion-safe:animate-pulse-ring"
              />
            </span>
            {t("order.live")}
          </p>
        )}
      </header>

      {/* ---- status ------------------------------------------------------ */}
      {failed ? (
        <section className="card mt-8 border-rust/40 bg-rust/5 p-6">
          <h2 className="font-display text-2xl font-bold text-rust">
            {t(`status.${order.status}` as never)}
          </h2>
          {order.reason && (
            <p className="mt-2 text-char/75">
              <span className="font-semibold">{t("order.rejectedReason")}:</span>{" "}
              {order.reason}
            </p>
          )}
          {/* Demo mode takes payment at the door (cash or POS), so nothing was charged to refund. */}
          {!DEMO_MODE && order.paymentMethod !== "cash" && (
            <p className="mt-3 text-sm text-char/70">{t("order.refundNote")}</p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <a href={`tel:${BRAND.phone.tel}`} className="btn-secondary">
              {t("order.callUs")}
            </a>
            <Link href="/menu" className="btn-primary">
              {t("hero.cta")}
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section className="card mt-8 p-6">
            <h2 className="font-display text-2xl font-bold">
              {t(`status.${order.status}` as never)}
            </h2>
            <p className="mt-2 text-char/70">
              {order.etaMinutes && order.etaConfirmedAt
                ? `${t("order.eta")}: ~${order.etaMinutes} ${t("menu.minutes")}`
                : t("order.etaPending")}
            </p>
            {["ACCEPTED", "PREPARING", "READY", "DISPATCHED"].includes(order.status) && (
              <EtaCountdown
                size="lg"
                className="mt-4"
                etaMinutes={order.etaMinutes}
                etaConfirmedAt={order.etaConfirmedAt}
                lateText={locale === "en" ? "Any minute now" : "Σε λίγο"}
              />
            )}

            <ol className="mt-6 space-y-0" aria-label={t("order.title")}>
              {steps.map((s, i) => {
                const done = i < currentIndex;
                const current = i === currentIndex;
                return (
                  <li key={s} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span
                        className={clsx(
                          "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                          done
                            ? "bg-rust text-onrust"
                            : current
                              ? "bg-rust text-onrust ring-4 ring-rust/20"
                              : "border border-line bg-surface text-char/40",
                        )}
                      >
                        {done ? "✓" : i + 1}
                      </span>
                      {i < steps.length - 1 && (
                        <span
                          aria-hidden="true"
                          className={clsx(
                            "w-px flex-1",
                            done ? "bg-rust" : "bg-line",
                          )}
                        />
                      )}
                    </div>
                    <p
                      className={clsx(
                        "pb-6 pt-0.5 font-semibold",
                        current ? "text-char" : done ? "text-char/70" : "text-char/40",
                      )}
                      aria-current={current ? "step" : undefined}
                    >
                      {t(`status.${s}` as never)}
                    </p>
                  </li>
                );
              })}
            </ol>
          </section>

          {order.cancellable && secondsLeft > 0 && (
            <section className="mt-4 rounded-card border border-line bg-surface p-4">
              <p className="text-sm text-char/70">{t("order.cancelWindow")}</p>
              <button
                type="button"
                onClick={() => {
                  // No window.confirm here: a native modal blocks the page and
                  // the realtime socket behind it. Two taps, inline.
                  if (secondsLeft > 0) void cancel();
                }}
                disabled={cancelling}
                className="btn-secondary mt-3 w-full text-sm disabled:opacity-60"
              >
                {t("order.cancel")} ({secondsLeft}s)
              </button>
            </section>
          )}
        </>
      )}

      {/* ---- items ------------------------------------------------------- */}
      <section className="card mt-6 p-6">
        <h2 className="font-display text-lg font-bold">{t("order.items")}</h2>
        <ul className="mt-4 divide-y divide-line">
          {order.items.map((it, i) => (
            <li key={`${it.menu_item_id}-${i}`} className="flex justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="font-semibold">
                  {it.quantity} × {pick(it.name, it.name_en)}
                </p>
                {it.item_notes && (
                  <p className="mt-0.5 text-sm italic text-char/60">
                    &ldquo;{it.item_notes}&rdquo;
                  </p>
                )}
              </div>
              <p className="shrink-0 font-semibold tabular-nums">
                {money(it.unit_price_cents * it.quantity)}
              </p>
            </li>
          ))}
        </ul>

        <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-char/70">{t("cart.subtotal")}</dt>
            <dd className="font-semibold">{money(order.subtotalCents)}</dd>
          </div>
          {order.deliveryFeeCents > 0 && (
            <div className="flex justify-between">
              <dt className="text-char/70">{t("cart.deliveryFee")}</dt>
              <dd className="font-semibold">{money(order.deliveryFeeCents)}</dd>
            </div>
          )}
          <div className="flex justify-between pt-1 text-base">
            <dt className="font-bold">{t("order.total")}</dt>
            <dd className="font-bold text-rust">{money(order.totalCents)}</dd>
          </div>
        </dl>
      </section>

      {!supabaseConfigured && !DEMO_MODE && (
        <p className="mt-4 text-center text-xs text-char/50">
          {/* Visible only on a deployment without Supabase configured. */}
          {DEV_BYPASS
            ? "Test mode — this page refreshes every few seconds."
            : "Realtime not configured — this page refreshes every 15s."}
        </p>
      )}

      <div className="mt-8 text-center">
        <a
          href={`tel:${BRAND.phone.tel}`}
          className="inline-flex min-h-touch items-center font-semibold text-rust underline underline-offset-4"
        >
          {t("order.callUs")} · {BRAND.phone.display}
        </a>
      </div>
    </div>
  );
}
