"use client";

import Link from "next/link";
import clsx from "clsx";
import { useEffect, useState, Suspense } from "react";
import {
  enableShopNotifications,
  notificationPermission,
  notifyNewOrder,
} from "@/lib/shop-notify";
import { ALERT_SOUNDS, useAlertSound, useOrders, type AlertSoundId } from "@/components/admin/useOrders";
import OrderCard from "@/components/admin/OrderCard";
import { PrintHost } from "@/components/admin/PrintTicket";
import InstallButton from "@/components/InstallButton";
import KitchenInstallCard from "@/components/admin/KitchenInstallCard";
import type { OrderStatus } from "@/lib/order-status";

/**
 * Shop screen: the orders still to handle (new, accepted). Delivered and
 * cancelled ones move to the 24-hour history view. The buttons move a ticket New → Accepted →
 * Delivered, and the customer's tracking page follows within seconds.
 */
const COLUMNS: { title: string; statuses: OrderStatus[]; accent: string }[] = [
  { title: "Νέες / New", statuses: ["PAID_AWAITING_ACCEPTANCE"], accent: "text-rust" },
  { title: "Αποδεκτές / Accepted", statuses: ["ACCEPTED", "PREPARING", "READY", "DISPATCHED"], accent: "text-gold" },
];
/** Finished orders leave the main screen; the history view keeps the last 24 hours. */
const FINISHED: OrderStatus[] = [
  "DELIVERED",
  "COMPLETED",
  "REJECTED",
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_RESTAURANT",
  "PAYMENT_FAILED",
];
const HISTORY_MS = 24 * 60 * 60 * 1000;

export default function DemoKitchenPage() {
  const { orders, loading, refresh, newArrival, clearArrival } = useOrders("all");
  const { enabled, enable, play, choice, setChoice } = useAlertSound();
  const [showHistory, setShowHistory] = useState(false);
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

  // Phone/tablet notifications: the device's own alert sound, which gets
  // through over music and with the screen off.
  const [notif, setNotif] = useState<string>("default");
  useEffect(() => setNotif(notificationPermission()), []);
  const askNotifications = async () => setNotif(await enableShopNotifications());

  // Ring (and notify) when a new order arrives, then ring every 10 s until accepted.
  useEffect(() => {
    if (!newArrival) return;
    play();
    const o = orders.find((x) => x.orderCode === newArrival);
    const items = o ? o.items.reduce((n, it) => n + it.quantity, 0) : 0;
    void notifyNewOrder(
      newArrival,
      o
        ? `${o.customerName} · ${o.fulfillmentType === "delivery" ? "Διανομή" : "Παραλαβή"} · ${items} προϊόντα`
        : "Άνοιξε την οθόνη καταστήματος",
    );
    clearArrival();
  }, [newArrival, play, clearArrival, orders]);
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

  const since = Date.now() - HISTORY_MS;
  const history = orders
    .filter((o) => FINISHED.includes(o.status) && new Date(o.createdAt).getTime() >= since)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="min-h-svh bg-sand">
      <PrintHost />
      <div className="mx-auto max-w-7xl px-4 py-6">
        {waiting > 0 && (
          <a
            href="#col-new"
            role="alert"
            className="kitchen-alert sticky top-[4.75rem] z-40 mb-4 flex items-center justify-center gap-3 rounded-2xl bg-rust px-4 py-4 text-center text-xl font-bold text-onrust shadow-lift"
          >
            🔔 {waiting === 1 ? "1 νέα παραγγελία" : `${waiting} νέες παραγγελίες`} · πάτα «Αποδοχή»
          </a>
        )}
        <Suspense fallback={null}>
          <KitchenInstallCard />
        </Suspense>
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
            <label className="sr-only" htmlFor="alert-sound">Ήχος παραγγελίας</label>
            <select
              id="alert-sound"
              value={choice.id}
              onChange={(e) => setChoice({ ...choice, id: e.target.value as AlertSoundId })}
              className="field !w-auto !py-2 text-sm"
              title="Ήχος νέας παραγγελίας (παίζει μία φορά για δοκιμή)"
            >
              {ALERT_SOUNDS.map((s) => (
                <option key={s.id} value={s.id}>
                  🔊 {s.label}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="alert-repeat">Επαναλήψεις</label>
            <select
              id="alert-repeat"
              value={choice.repeat}
              onChange={(e) => setChoice({ ...choice, repeat: Number(e.target.value) })}
              className="field !w-auto !py-2 text-sm"
              title="Πόσες φορές παίζει ο ήχος σε κάθε ειδοποίηση"
            >
              <option value={1}>×1</option>
              <option value={2}>×2</option>
              <option value={3}>×3</option>
            </select>
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className={showHistory ? "btn-primary text-sm" : "btn-secondary text-sm"}
            >
              {showHistory ? "← Τρέχουσες" : `🕘 Ιστορικό 24ώρου (${history.length})`}
            </button>
            {notif !== "granted" && (
              <button
                type="button"
                onClick={askNotifications}
                className="btn-secondary text-sm"
                title={
                  notif === "unsupported"
                    ? "Σε iPhone/iPad: πρόσθεσε πρώτα την οθόνη στην αρχική οθόνη (Κοινοποίηση → Προσθήκη στην οθόνη Αφετηρίας)"
                    : "Ειδοποίηση με τον ήχο της συσκευής, ακούγεται και πάνω από μουσική"
                }
              >
                {notif === "denied"
                  ? "📵 Ειδοποιήσεις μπλοκαρισμένες"
                  : notif === "unsupported"
                    ? "📲 Ειδοποιήσεις: πρόσθεσε στην αρχική οθόνη"
                    : "📲 Ενεργοποίηση ειδοποιήσεων"}
              </button>
            )}
            <InstallButton app="kitchen" variant="pill" label="Εγκατάσταση ως εφαρμογή" />
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
        ) : showHistory ? (
          <section aria-label="Ιστορικό 24ώρου">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-char/60">
              Ολοκληρωμένες και ακυρωμένες, τελευταίες 24 ώρες ({history.length})
            </h2>
            {history.length === 0 ? (
              <p className="rounded-card border border-dashed border-line p-6 text-center text-sm text-char/45">—</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {history.map((o) => (
                  <OrderCard key={o.id} order={o} onChanged={refresh} compact />
                ))}
              </div>
            )}
          </section>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {COLUMNS.map((col) => {
              const list = orders.filter((o) => col.statuses.includes(o.status));
              return (
                <section
                  key={col.title}
                  id={col.statuses.includes("PAID_AWAITING_ACCEPTANCE") ? "col-new" : undefined}
                  aria-label={col.title}
                  className="scroll-mt-24"
                >
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

      </div>
    </div>
  );
}
