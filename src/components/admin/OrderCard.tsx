"use client";

import { useState } from "react";
import clsx from "clsx";
import { useAdminAuth } from "./AdminAuth";
import { usePrintOrder } from "./PrintTicket";
import EtaCountdown from "@/components/EtaCountdown";
import type { AdminOrder } from "./useOrders";
import { formatEuro } from "@/lib/money";
import { REJECTION_REASONS, DEFAULT_ETA_MINUTES, zoneById } from "@/lib/brand";
import { requiresReason, type OrderStatus } from "@/lib/order-status";
import { dict } from "@/i18n/dictionaries";
import { DEMO_MODE } from "@/lib/demo/config";

/** Demo orders are paid at the door, so "card" tells the driver to take the POS. */
const PAY_LABEL: Record<string, string> = {
  cash: "ΜΕΤΡΗΤΑ",
  card: DEMO_MODE ? "ΚΑΡΤΑ (POS)" : "ΚΑΡΤΑ",
};

const STATUS_LABEL = (s: OrderStatus) =>
  (dict.el as Record<string, string>)[`status.${s}`] ?? s;

/** States where the clock runs down to the time promised to the customer. */
const COUNTING: OrderStatus[] = ["ACCEPTED", "PREPARING", "READY", "DISPATCHED"];

/** Primary action per state, so staff never hunt for the obvious next tap. */
const PRIMARY_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  ACCEPTED: "DELIVERED",
  PREPARING: "DELIVERED",
  READY: "DELIVERED",
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
  const [open, setOpen] = useState(!compact);
  const itemCount = order.items.reduce((n, it) => n + it.quantity, 0);

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
      if (to === "ACCEPTED") {
        // Accepting prints the kitchen ticket straight away, with the ETA just
        // promised. The refresh waits so the card doesn't move columns (and
        // unmount the ticket) while the print dialog is still preparing.
        const at = new Date().toISOString();
        print({ ...order, status: "ACCEPTED", etaMinutes: Number(extra.etaMinutes) || order.etaMinutes, etaConfirmedAt: at });
        window.setTimeout(onChanged, 1500);
      } else {
        onChanged();
      }
    } finally {
      setBusy(false);
    }
  };

  const isNew = order.status === "PAID_AWAITING_ACCEPTANCE";
  const primary = PRIMARY_NEXT[order.status];
  const primaryForFulfillment = primary;

  const canCancel = order.allowedNext.includes("CANCELLED_BY_RESTAURANT");

  return (
    <article
      className={clsx(
        "card overflow-hidden",
        isNew && "border-rust ring-2 ring-rust/30",
      )}
    >
      {/* ---- header ------------------------------------------------------ */}
      {/* ---- summary: the box you see in the list; tap to open ------------ */}
      <header
        role={compact ? "button" : undefined}
        tabIndex={compact ? 0 : undefined}
        aria-expanded={compact ? open : undefined}
        onClick={compact ? () => setOpen((o) => !o) : undefined}
        onKeyDown={
          compact
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpen((o) => !o);
                }
              }
            : undefined
        }
        className={clsx(
          "space-y-2 px-4 py-3",
          compact && "cursor-pointer select-none",
          isNew ? "bg-rust text-onrust" : "bg-char/5",
        )}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-display text-2xl font-bold tracking-wider tabular-nums">
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
          <div className="ml-auto flex items-center gap-2">
            {COUNTING.includes(order.status) ? (
              <EtaCountdown size="lg" etaMinutes={order.etaMinutes} etaConfirmedAt={order.etaConfirmedAt} />
            ) : (
              <span
                className={clsx(
                  "rounded-full px-3 py-1 text-xl font-bold tabular-nums",
                  isNew ? "bg-onrust/20" : "bg-char/10 text-char/70",
                )}
                title="Πόση ώρα περιμένει"
              >
                {waitedMinutes}′
              </span>
            )}
            {compact && (
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className={clsx("size-6 shrink-0 transition-transform", open && "rotate-180")}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-base">
          <span className="font-semibold">{order.customerName}</span>
          <span className={clsx("tabular-nums", isNew ? "opacity-90" : "text-char/70")}>
            {itemCount} προϊόντα · <b>{money(order.totalCents)}</b>
          </span>
        </div>
        <p className={clsx("text-sm font-semibold", isNew ? "opacity-90" : "text-char/60")}>
          {STATUS_LABEL(order.status)}
          {!open && order.fulfillmentType === "delivery" && order.customerAddress
            ? ` · ${order.customerAddress}`
            : ""}
        </p>
      </header>

      {open && (
        <>
      {/* ---- who and where ------------------------------------------------ */}
      <div className="border-t border-line px-4 py-3 text-base">
        <p className="text-lg font-bold">{order.customerName}</p>
        <a
          href={`tel:${order.customerPhone}`}
          className="inline-flex min-h-touch items-center text-lg font-semibold text-rust underline underline-offset-4"
        >
          {order.customerPhone}
        </a>
        {order.fulfillmentType === "delivery" ? (
          <p className="mt-1 font-semibold">
            Διεύθυνση: <span className="font-normal">{order.customerAddress ?? "—"}</span>
            {order.deliveryZone && (
              <span className="text-char/50"> · {zoneById(order.deliveryZone)?.el ?? order.deliveryZone}</span>
            )}
          </p>
        ) : (
          <p className="mt-1 font-semibold">Παραλαβή από το κατάστημα</p>
        )}
        <p className="mt-1 text-sm text-char/60">
          Πληρωμή: {PAY_LABEL[order.paymentMethod] ?? order.paymentMethod.toUpperCase()}
          {order.paymentStatus ? ` (${order.paymentStatus})` : ""} · Παραγγέλθηκε{" "}
          {new Date(order.createdAt).toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" })}
          {order.etaMinutes ? ` · ETA ${order.etaMinutes}′` : ""}
        </p>
      </div>

      {/* ---- products ----------------------------------------------------- */}
      <ul className="divide-y divide-line border-t border-line">
        {order.items.map((it, i) => (
          <li key={`${it.menu_item_id}-${i}`} className="flex gap-3 px-4 py-2.5">
            <span className="min-w-8 text-xl font-bold tabular-nums text-rust">
              {it.quantity}×
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold leading-snug">{it.name}</p>
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
              {DEMO_MODE
                ? "Ο πελάτης το βλέπει στη σελίδα της παραγγελίας. Δεν έχει χρεωθεί τίποτα (πληρωμή στην πόρτα)."
                : "Ο πελάτης ενημερώνεται με SMS και το ποσό επιστρέφεται αυτόματα."}
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
                title="Αποδοχή και εκτύπωση δελτίου"
              >
                Αποδοχή & εκτύπωση
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => print(order)} className="btn-secondary" title="Εκτύπωση δελτίου παραγγελίας">
              Εκτύπωση
            </button>
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
        </>
      )}
      {ticket}
    </article>
  );
}
