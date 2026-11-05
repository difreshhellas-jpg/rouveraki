"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { useOrders, useAlertSound } from "@/components/admin/useOrders";
import OrderCard from "@/components/admin/OrderCard";
import { PrintHost } from "@/components/admin/PrintTicket";

export default function AdminOrdersPage() {
  const [view, setView] = useState<"live" | "all">("live");
  const { orders, loading, error, live, refresh, newArrival, clearArrival } =
    useOrders(view);
  const sound = useAlertSound();

  // Audible alert on a new order waiting to be accepted (spec §4).
  useEffect(() => {
    if (!newArrival) return;
    sound.play();
    clearArrival();
  }, [newArrival, sound, clearArrival]);

  const waiting = orders.filter((o) => o.status === "PAID_AWAITING_ACCEPTANCE");
  const rest = orders.filter((o) => o.status !== "PAID_AWAITING_ACCEPTANCE");

  return (
    <div>
      <PrintHost />
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold">Παραγγελίες</h1>

        <span
          className={clsx(
            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
            live ? "bg-emerald-600/10 text-emerald-700" : "bg-char/10 text-char/60",
          )}
        >
          <span
            className={clsx(
              "size-2 rounded-full",
              live ? "bg-emerald-600" : "bg-char/40",
            )}
          />
          {live ? "Ζωντανά" : "Χωρίς σύνδεση realtime"}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {!sound.enabled && (
            <button type="button" onClick={sound.enable} className="btn-secondary text-sm">
              Ενεργοποίηση ήχου
            </button>
          )}
          <div className="inline-flex rounded-full border border-line p-0.5 text-sm font-semibold">
            {(["live", "all"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={clsx(
                  "min-h-9 rounded-full px-4",
                  view === v ? "bg-rust text-onrust" : "text-char/70",
                )}
              >
                {v === "live" ? "Ενεργές" : "Ιστορικό"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {error && (
        <p role="alert" className="mb-4 rounded-card border border-rust/40 bg-rust/10 p-3 text-sm text-rust">
          Σφάλμα φόρτωσης: {error}
        </p>
      )}

      {loading ? (
        <p className="py-16 text-center text-char/60">Φόρτωση...</p>
      ) : orders.length === 0 ? (
        <p className="py-16 text-center text-char/60">Καμία παραγγελία.</p>
      ) : (
        <div className="space-y-6">
          {waiting.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-rust">
                Αναμονή αποδοχής ({waiting.length})
              </h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {waiting.map((o) => (
                  <OrderCard key={o.id} order={o} onChanged={refresh} />
                ))}
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-char/55">
                {view === "live" ? "Σε εξέλιξη" : "Ιστορικό"} ({rest.length})
              </h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {rest.map((o) => (
                  <OrderCard key={o.id} order={o} onChanged={refresh} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
