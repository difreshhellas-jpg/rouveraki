"use client";

import { useEffect } from "react";
import clsx from "clsx";
import { useOrders, useAlertSound } from "@/components/admin/useOrders";
import OrderCard from "@/components/admin/OrderCard";
import { PrintHost } from "@/components/admin/PrintTicket";
import type { OrderStatus } from "@/lib/order-status";

/**
 * Kitchen queue — built for a wall-mounted iPad with flour on it.
 *
 * Three columns, large type, item notes shown inline on every ticket rather
 * than behind a tap, and no customer contact details: the kitchen needs the
 * food, the counter needs the phone number.
 */
const COLUMNS: { title: string; statuses: OrderStatus[]; accent: string }[] = [
  { title: "Νέες", statuses: ["PAID_AWAITING_ACCEPTANCE"], accent: "text-rust" },
  { title: "Στη σειρά", statuses: ["ACCEPTED", "PREPARING", "READY"], accent: "text-gold" },
  { title: "Έτοιμες", statuses: ["DISPATCHED"], accent: "text-emerald-700" },
];

export default function KitchenPage() {
  const { orders, loading, live, refresh, newArrival, clearArrival } =
    useOrders("live");
  const sound = useAlertSound();

  useEffect(() => {
    if (!newArrival) return;
    sound.play();
    clearArrival();
  }, [newArrival, sound, clearArrival]);

  return (
    <div>
      <PrintHost />
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold">Κουζίνα</h1>
        <span
          className={clsx(
            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
            live ? "bg-emerald-600/10 text-emerald-700" : "bg-char/10 text-char/60",
          )}
        >
          <span className={clsx("size-2 rounded-full", live ? "bg-emerald-600" : "bg-char/40")} />
          {live ? "Ζωντανά" : "Χωρίς σύνδεση realtime"}
        </span>
        {!sound.enabled && (
          <button type="button" onClick={sound.enable} className="btn-secondary ml-auto text-sm">
            Ενεργοποίηση ήχου
          </button>
        )}
      </header>

      {loading ? (
        <p className="py-16 text-center text-char/60">Φόρτωση...</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {COLUMNS.map((col) => {
            const list = orders.filter((o) => col.statuses.includes(o.status));
            return (
              <section key={col.title} aria-labelledby={`col-${col.title}`}>
                <h2
                  id={`col-${col.title}`}
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
    </div>
  );
}
