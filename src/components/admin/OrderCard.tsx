"use client";

import { useState } from "react";
import clsx from "clsx";
import { useAdminAuth } from "./AdminAuth";
import { usePrintOrder } from "./PrintTicket";
import type { AdminOrder } from "./useOrders";
import { formatEuro } from "@/lib/money";
import { REJECTION_REASONS, DEFAULT_ETA_MINUTES, zoneById } from "@/lib/brand";
import { requiresReason, type OrderStatus } from "@/lib/order-status";
import { dict } from "@/i18n/dictionaries";

const STATUS_LABEL = (s: OrderStatus) =>
  (dict.el as Record<string, string>)[`status.${s}`] ?? s;

/** Primary action per state, so staff never hunt for the obvious next tap. */
const PRIMARY_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  ACCEPTED: "PREPARING",
  PREPARING: "READY",
  READY: "DISPATCHED",
  DISPATCHED: "DELIVERED",
};

export default function OrderCard({
  order,
  onChanged,
  compact = false,
}: {
  order: AdminOrder;
  onChanged: () => void;
  compact?: boolean;
}) {
  const { authFetch } = useAdminAuth();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reasonId, setReasonId] = useState<string>(REJECTION_REASONS[0].id);
  const [reasonText, setReasonText] = useState("");
  const [eta, setEta] = useState<number>(
    order.etaMinutes ?? DEFAULT_ETA_MINUTES[order.fulfillmentType],
  );
  const [error, setError] = useState<string | null>(null);
  const { print, ticket } = usePrintOrder();

  const money = (c: number) => formatEuro(c / 100, "el-GR");
  const waitedMinutes = Math.floor(
    (Date.now() - new Date(order.createdAt).getTime()) / 60000,
  );

  const transition = async (to: OrderStatus, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch(`/api/admin/orders/${order.id}/transition`, {
        method: "POST",
        body: JSON.stringify({ to, expectedFrom: order.status, ...extra }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(
          data.error === "stale_state"
            ? "Η παραγγελία άλλαξε στο μεταξύ - ανανεώνω."
            : (data.error ?? "Σφάλμα"),
        );
        onChanged();
        return;
      }
      setRejecting(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const isNew = order.status === "PAID_AWAITING_ACCEPTANCE";
  const primary = PRIMARY_NEXT[order.status];
  // A pickup order that is READY is completed, not dispatched.
  const primaryForFulfillment =
    order.status === "READY" && order.fulfillmentType === "pickup"
      ? ("COMPLETED" as OrderStatus)
      : primary;

  const canCancel = order.allowedNext.includes("CANCELLED_BY_RESTAURANT");

  return (
    <article
      className={clsx(
        "card overflow-hidden",
        isNew && "border-rust ring-2 ring-rust/30",
      )}
    >
      {/* ---- header ------------------------------------------------------ */}
      <header
        className={clsx(
          "flex flex-wrap items-center justify-between gap-3 px-4 py-3",
          isNew ? "bg-rust text-onrust" : "bg-char/5",
        )}
      >
        <div className="flex items-center gap-3">
          <span className="font-display text-xl font-bold tracking-wider tabular-nums">
            {order.orderCode}
          </span>
          <span
            className={clsx(
              "rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide",
              isNew ? "bg-onrust/20" : "bg-char/10",
            )}
          >
            {order.fulfillmentType === "delivery" ? "Διανομή" : "Παραλαβή"}
          </span>
          {order.ageVerified && (
            <span
              className={clsx(
                "rounded-full px-2.5 py-0.5 text-xs font-bold",
                isNew ? "bg-onrust/20" : "bg-char/10",
              )}
              title="Το καλάθι περιείχε αλκοόλ - ο πελάτης δήλωσε 18+"
            >
              18+
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-sm">
          <span className={clsx("font-semibold", !isNew && "text-char/70")}>
            {STATUS_LABEL(order.status)}
          </span>
          <span className={clsx("tabular-nums", isNew ? "opacity-85" : "text-char/55")}>
            {waitedMinutes}′
          </span>
          <span className="font-bold tabular-nums">{money(order.totalCents)}</span>
          <button
            type="button"
            onClick={() => print(order)}
            className={clsx(
              "inline-flex min-h-touch items-center gap-1.5 rounded-lg px-3 text-xs font-bold uppercase tracking-wide",
              isNew ? "bg-onrust/20 hover:bg-onrust/30" : "bg-char/10 hover:bg-char/15",
            )}
            title="Εκτύπωση δελτίου παραγγελίας"
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M6 14h12v7H6z" />
            </svg>
            Εκτύπωση
          </button>
        </div>
      </header>

      {/* ---- items: always visible, never behind a tap ------------------- */}
      <ul className="divide-y divide-line">
        {order.items.map((it, i) => (
          <li key={`${it.menu_item_id}-${i}`} className="flex gap-3 px-4 py-2.5">
            <span className="min-w-8 text-lg font-bold tabular-nums text-rust">
              {it.quantity}×
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-snug">{it.name}</p>
              {it.item_notes && (
                <p className="mt-0.5 rounded bg-rust/10 px-2 py-1 text-sm font-semibold text-rust">
                  {it.item_notes}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {order.generalNotes && (
        <p className="border-t border-line bg-gold/10 px-4 py-2.5 text-sm font-semibold">
          Σημείωση παραγγελίας: {order.generalNotes}
        </p>
      )}

      {/* ---- customer ---------------------------------------------------- */}
      {!compact && (
        <div className="border-t border-line px-4 py-3 text-sm">
          <p className="font-semibold">{order.customerName}</p>
          <a
            href={`tel:${order.customerPhone}`}
            className="inline-flex min-h-touch items-center font-semibold text-rust underline underline-offset-4"
          >
            {order.customerPhone}
          </a>
          {order.customerAddress && (
            <p className="mt-1 text-char/75">
              {order.customerAddress}
              {order.deliveryZone && (
                <span className="text-char/50">
                  {" "}
                  · {zoneById(order.deliveryZone)?.el ?? order.deliveryZone}
                </span>
              )}
            </p>
          )}
          <p className="mt-1 text-char/55">
            Πληρωμή: {order.paymentMethod.toUpperCase()}
            {order.paymentStatus ? ` (${order.paymentStatus})` : ""}
            {order.etaMinutes ? ` · ETA ${order.etaMinutes}′` : ""}
          </p>
        </div>
      )}

      {/* ---- actions ----------------------------------------------------- */}
      <div className="border-t border-line bg-surface p-4">
        {error && (
          <p role="alert" className="mb-3 text-sm font-semibold text-rust">
            {error}
          </p>
        )}

        {rejecting ? (
          <div className="space-y-3">
            <div>
              <label className="label" htmlFor={`reason-${order.id}`}>
                Λόγος απόρριψης
              </label>
              <select
                id={`reason-${order.id}`}
                value={reasonId}
                onChange={(e) => setReasonId(e.target.value)}
                className="field"
              >
                {REJECTION_REASONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.el}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              maxLength={300}
              placeholder="Λεπτομέρειες (προαιρετικά)"
              className="field"
            />
            <p className="text-sm text-char/65">
              Ο πελάτης ενημερώνεται με SMS και το ποσό επιστρέφεται αυτόματα.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRejecting(false)}
                className="btn-secondary flex-1"
              >
                Άκυρο
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void transition(
                    isNew ? "REJECTED" : "CANCELLED_BY_RESTAURANT",
                    { reasonId, reasonText },
                  )
                }
                className="btn flex-1 bg-rust text-onrust disabled:opacity-60"
              >
                Επιβεβαίωση
              </button>
            </div>
          </div>
        ) : isNew ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="label mb-0 shrink-0" htmlFor={`eta-${order.id}`}>
                ETA (λεπτά)
              </label>
              <input
                id={`eta-${order.id}`}
                type="number"
                min={1}
                max={240}
                value={eta}
                onChange={(e) => setEta(Number(e.target.value))}
                className="field w-28"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRejecting(true)}
                disabled={busy}
                className="btn-secondary flex-1"
              >
                Απόρριψη
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void transition("ACCEPTED", { etaMinutes: eta })}
                className="btn flex-[2] bg-emerald-600 text-white disabled:opacity-60"
              >
                Αποδοχή
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {primaryForFulfillment && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void transition(primaryForFulfillment)}
                className="btn-primary flex-1 disabled:opacity-60"
              >
                {STATUS_LABEL(primaryForFulfillment)}
              </button>
            )}
            {order.status === "READY" && order.fulfillmentType === "delivery" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void transition("COMPLETED")}
                className="btn-secondary"
                title="Ο πελάτης το πήρε από το κατάστημα"
              >
                Παραλήφθηκε
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                onClick={() => setRejecting(true)}
                disabled={busy}
                className="btn-ghost text-sm text-rust"
              >
                Ακύρωση
              </button>
            )}
          </div>
        )}

        {requiresReason(order.status) && order.lastReason && (
          <p className="mt-3 text-sm text-char/65">Λόγος: {order.lastReason}</p>
        )}
      </div>
      {ticket}
    </article>
  );
}
