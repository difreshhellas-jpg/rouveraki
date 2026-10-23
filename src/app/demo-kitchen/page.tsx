"use client";

import Link from "next/link";
import clsx from "clsx";
import { useOrders } from "@/components/admin/useOrders";
import OrderCard from "@/components/admin/OrderCard";
import { clearDemoOrders } from "@/lib/demo/store";
import type { OrderStatus } from "@/lib/order-status";

/**
 * "Shop owner view" for demos: every order placed in this browser, in four
 * columns. The buttons on each ticket move it New → Preparing → Ready →
 * Delivered, and the customer's tracking page (same browser) follows live.
 */
const COLUMNS: { title: string; statuses: OrderStatus[]; accent: string }[] = [
  { title: "Νέες / New", statuses: ["PAID_AWAITING_ACCEPTANCE"], accent: "text-rust" },
  { title: "Σε προετοιμασία / Preparing", statuses: ["ACCEPTED", "PREPARING"], accent: "text-gold" },
  { title: "Έτοιμες / Ready", statuses: ["READY", "DISPATCHED"], accent: "text-emerald-700" },
  { title: "Παραδόθηκαν / Delivered", statuses: ["DELIVERED", "COMPLETED"], accent: "text-char/60" },
];

export default function DemoKitchenPage() {
  const { orders, loading, refresh } = useOrders("all");
  const other = orders.filter(
    (o) => !COLUMNS.some((c) => c.statuses.includes(o.status)),
  );

  return (
    <div className="min-h-svh bg-sand">
      <p className="bg-rust px-4 py-2 text-center text-sm font-bold text-onrust">
        DEMO - οι παραγγελίες υπάρχουν μόνο σε αυτόν τον browser · no real notifications
      </p>
      <div className="mx-auto max-w-7xl px-4 py-6">
        <header className="mb-5 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-bold">
            Ρουβεράκι <span className="text-char/50">οθόνη καταστήματος</span>
          </h1>
          <div className="ml-auto flex gap-2">
            <Link href="/menu" className="btn-secondary text-sm">
              Πίσω στο site
            </Link>
            <button
              type="button"
              className="btn-ghost text-sm text-rust"
              onClick={() => {
                clearDemoOrders();
                void refresh();
              }}
            >
              Καθαρισμός demo παραγγελιών
            </button>
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
