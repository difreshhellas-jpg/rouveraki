"use client";

import Link from "next/link";
import clsx from "clsx";
import { useEffect } from "react";
import { useAlertSound, useOrders } from "@/components/admin/useOrders";
import OrderCard from "@/components/admin/OrderCard";
import { PrintHost } from "@/components/admin/PrintTicket";
import type { OrderStatus } from "@/lib/order-status";

/**
 * Shop screen: every order from the last two days, from any customer's
 * device, in three columns. The buttons on each ticket move it New → Accepted →
 * Delivered, and the customer's tracking page follows within seconds.
 */
const COLUMNS: { title: string; statuses: OrderStatus[]; accent: string }[] = [
  { title: "Νέες / New", statuses: ["PAID_AWAITING_ACCEPTANCE"], accent: "text-rust" },
  { title: "Αποδεκτές / Accepted", statuses: ["ACCEPTED", "PREPARING", "READY", "DISPATCHED"], accent: "text-gold" },
  { title: "Παραδόθηκαν / Delivered", statuses: ["DELIVERED", "COMPLETED"], accent: "text-char/60" },
];

export default function DemoKitchenPage() {
  const { orders, loading, refresh, newArrival, clearArrival } = useOrders("all");
  const { enabled, enable, play } = useAlertSound();
  const waiting = orders.filter((o) => o.status === "PAID_AWAITING_ACCEPTANCE").length;

  // Browsers only allow sound after a tap, so the first tap anywhere turns it on.
  useEffect(() => {
    if (enabled) return;
    const on = () => enable();
    window.addEventListener("pointerdown", on, { once: true });
    window.addEventListener("keydown", on, { once: true });
    return () => {
      window.removeEventListener("pointerdown", on);
      window.removeEventListener("keydown", on);
    };
  }, [enabled, enable]);

  // Beep when a new order arrives, then every 10 s until it is accepted.
  useEffect(() => {
    if (newArrival) {
      play();
      clearArrival();
    }
  }, [newArrival, play, clearArrival]);
  useEffect(() => {
    if (!enabled || waiting === 0) return;
    const id = window.setInterval(play, 10_000);
    return () => window.clearInterval(id);
  }, [enabled, waiting, play]);

  // Tab title shows the waiting count, so a new order is visible from another tab.
  useEffect(() => {
    document.title = waiting > 0 ? `(${waiting}) Νέα παραγγελία · Ρουβεράκι` : "Οθόνη καταστήματος · Ρουβεράκι";
  }, [waiting]);

  // Keep the shop tablet awake while this screen is open: a sleeping screen
  // stops checking for orders and cannot ring.
  useEffect(() => {
    type Lock = { release: () => Promise<void> };
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Lock> } }).wakeLock;
    if (!wl) return;
    let lock: Lock | null = null;
    const take = () => {
      if (document.visibilityState === "visible") {
        wl.request("screen").then((l) => (lock = l), () => {});
      }
    };
    take();
    document.addEventListener("visibilitychange", take);
    return () => {
      document.removeEventListener("visibilitychange", take);
      void lock?.release().catch(() => {});
    };
  }, []);

  const other = orders.filter(
    (o) => !COLUMNS.some((c) => c.statuses.includes(o.status)),
  );

  return (
    <div className="min-h-svh bg-sand">
      <PrintHost />
      <div className="mx-auto max-w-7xl px-4 py-6">
        <header className="mb-5 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-bold">
            Ρουβεράκι <span className="text-char/50">οθόνη καταστήματος</span>
          </h1>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => (enabled ? play() : enable())}
              className={enabled ? "btn-secondary text-sm" : "btn-primary animate-pulse text-sm"}
            >
              {enabled ? "🔔 Ήχος ενεργός (δοκιμή)" : "🔔 Ενεργοποίηση ήχου"}
            </button>
            <Link href="/demo-kitchen/menu" className="btn-primary text-sm">
              Διαχείριση μενού
            </Link>
            <Link href="/menu" className="btn-secondary text-sm">
              Πίσω στο site
            </Link>
          </div>
        </header>

        {loading ? (
          <p className="py-16 text-center text-char/60">Φόρτωση...</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map((col) => {
              const list = orders.filter((o) => col.statuses.includes(o.status));
              return (
                <section key={col.title} aria-label={col.title}>
                  <h2
                    className={clsx(
                      "mb-3 text-sm font-bold uppercase tracking-wide",
                      col.accent,
                    )}
                  >
                    {col.title} ({list.length})
                  </h2>
                  <div className="space-y-4">
                    {list.length === 0 ? (
                      <p className="rounded-card border border-dashed border-line p-6 text-center text-sm text-char/45">
                        —
                      </p>
                    ) : (
                      list.map((o) => (
                        <OrderCard key={o.id} order={o} onChanged={refresh} compact />
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {other.length > 0 && (
          <section className="mt-8" aria-label="cancelled">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-char/50">
              Ακυρωμένες / Cancelled ({other.length})
            </h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {other.map((o) => (
                <OrderCard key={o.id} order={o} onChanged={refresh} compact />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
