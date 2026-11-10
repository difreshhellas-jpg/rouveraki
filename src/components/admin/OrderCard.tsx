"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { useAdminAuth } from "./AdminAuth";
import { printOrder } from "./PrintTicket";
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

/** Finished orders: no clock of any kind. */
const FINISHED: OrderStatus[] = [
  "DELIVERED",
  "COMPLETED",
  "REJECTED",
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_RESTAURANT",
  "PAYMENT_FAILED",
];

export default function OrderCard({
  order,
  onChanged,
}: {
  order: AdminOrder;
  onChanged: () => void;
  /** Kept for the callers that still pass it; every card is the compact box now. */
  compact?: boolean;
}) {
  const { authFetch } = useAdminAuth();
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reasonId, setReasonId] = useState<string>(REJECTION_REASONS[0].id);
  const [reasonText, setReasonText] = useState("");
  const [eta, setEta] = useState<number>(
    order.etaMinutes ?? DEFAULT_ETA_MINUTES[order.fulfillmentType],
  );
  const [error, setError] = useState<string | null>(null);

  const money = (c: number) => formatEuro(c / 100, "el-GR");
  const waitedMinutes = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000);
  const itemCount = order.items.reduce((n, it) => n + it.quantity, 0);
  const isNew = order.status === "PAID_AWAITING_ACCEPTANCE";
  const counting = COUNTING.includes(order.status);
  const finished = FINISHED.includes(order.status);
  const canDeliver = order.allowedNext.includes("DELIVERED");
  const canCancel = order.allowedNext.includes("CANCELLED_BY_RESTAURANT");

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
        // Accepting prints the kitchen ticket straight away, with the ETA just promised.
        printOrder({
          ...order,
          status: "ACCEPTED",
          etaMinutes: Number(extra.etaMinutes) || order.etaMinutes,
          etaConfirmedAt: new Date().toISOString(),
        });
      }
      setDetail(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const accept = () => void transition("ACCEPTED", { etaMinutes: eta });

  /** Chip shown top right: the running clock, or the waiting time of a new order. Nothing once finished. */
  const clock = counting ? (
    <EtaCountdown size="lg" etaMinutes={order.etaMinutes} etaConfirmedAt={order.etaConfirmedAt} />
  ) : isNew ? (
    <span className="rounded-full bg-onrust/20 px-3 py-1 text-xl font-bold tabular-nums" title="Πόση ώρα περιμένει">
      {waitedMinutes}′
    </span>
  ) : null;

  return (
    <article
      data-order={order.orderCode}
      className={clsx(
        "card overflow-hidden",
        isNew && "border-rust ring-2 ring-rust/30",
        finished && "opacity-80",
      )}
    >
      {/* ---- the box in the list -------------------------------------------- */}
      <div className={clsx("space-y-2 px-4 pt-3", isNew ? "bg-rust text-onrust" : "bg-char/5")}>
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
          {clock && <div className="ml-auto">{clock}</div>}
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-lg font-semibold">{order.customerName}</span>
          <span className={clsx("tabular-nums", isNew ? "opacity-90" : "text-char/70")}>
            {itemCount} προϊόντα · <b>{money(order.totalCents)}</b>
          </span>
        </div>
        {order.fulfillmentType === "delivery" && order.customerAddress && (
          <p className={clsx("truncate text-sm font-semibold", isNew ? "opacity-90" : "text-char/60")}>
            {order.customerAddress}
          </p>
        )}
        <p className={clsx("pb-3 text-sm font-semibold", isNew ? "opacity-90" : "text-char/60")}>
          {STATUS_LABEL(order.status)}
        </p>
      </div>

      {/* ---- quick actions: no need to open anything ------------------------ */}
      <div className="flex gap-2 border-t border-line bg-surface p-3">
        {isNew && (
          <button
            type="button"
            disabled={busy}
            onClick={accept}
            className="btn flex-[2] bg-emerald-600 text-white disabled:opacity-60"
            title={`Αποδοχή (${eta}′) και εκτύπωση δελτίου`}
          >
            Αποδοχή & εκτύπωση
          </button>
        )}
        {canDeliver && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void transition("DELIVERED")}
            className="btn-primary flex-[2] disabled:opacity-60"
          >
            Παραδόθηκε
          </button>
        )}
        <button
          type="button"
          onClick={() => setDetail(true)}
          className="btn-secondary flex-1"
          aria-haspopup="dialog"
        >
          Άνοιγμα
        </button>
      </div>
      {error && !detail && (
        <p role="alert" className="border-t border-line px-4 py-2 text-sm font-semibold text-rust">
          {error}
        </p>
      )}

      {/* ---- the full order, in its own window ------------------------------ */}
      {detail && (
        <Detail onClose={() => setDetail(false)} label={order.orderCode}>
          <div className={clsx("flex flex-wrap items-center gap-x-3 gap-y-2 py-4 pl-5 pr-16", isNew ? "bg-rust text-onrust" : "bg-char/5")}>
            <span className="font-display text-3xl font-bold tracking-wider tabular-nums">
              {order.orderCode}
            </span>
            <span className="rounded-full bg-black/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide">
              {order.fulfillmentType === "delivery" ? "Διανομή" : "Παραλαβή"}
            </span>
            {clock && <div className="ml-auto">{clock}</div>}
          </div>

          <div className="space-y-1 border-t border-line px-5 py-4">
            <p className="text-xl font-bold">{order.customerName}</p>
            <a
              href={`tel:${order.customerPhone}`}
              className="inline-flex min-h-touch items-center text-xl font-semibold text-rust underline underline-offset-4"
            >
              {order.customerPhone}
            </a>
            {order.fulfillmentType === "delivery" ? (
              <p className="text-lg font-semibold">
                {order.customerAddress ?? "—"}
                {order.deliveryZone && (
                  <span className="font-normal text-char/50">
                    {" "}
                    · {zoneById(order.deliveryZone)?.el ?? order.deliveryZone}
                  </span>
                )}
              </p>
            ) : (
              <p className="text-lg font-semibold">Παραλαβή από το κατάστημα</p>
            )}
            <p className="text-sm text-char/60">
              Πληρωμή: {PAY_LABEL[order.paymentMethod] ?? order.paymentMethod.toUpperCase()}
              {order.paymentStatus ? ` (${order.paymentStatus})` : ""} · Παραγγέλθηκε{" "}
              {new Date(order.createdAt).toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>

          <ul className="divide-y divide-line border-t border-line">
            {order.items.map((it, i) => (
              <li key={`${it.menu_item_id}-${i}`} className="flex gap-3 px-5 py-3">
                <span className="min-w-9 text-2xl font-bold tabular-nums text-rust">{it.quantity}×</span>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold leading-snug">{it.name}</p>
                  {it.item_notes && (
                    <p className="mt-0.5 rounded bg-rust/10 px-2 py-1 text-sm font-semibold text-rust">
                      {it.item_notes}
                    </p>
                  )}
                </div>
                <span className="tabular-nums text-char/70">{money(it.unit_price_cents * it.quantity)}</span>
              </li>
            ))}
            <li className="flex justify-between px-5 py-3 text-lg font-bold">
              <span>Σύνολο</span>
              <span className="tabular-nums">{money(order.totalCents)}</span>
            </li>
          </ul>

          {order.generalNotes && (
            <p className="border-t border-line bg-gold/10 px-5 py-3 text-sm font-semibold">
              Σημείωση παραγγελίας: {order.generalNotes}
            </p>
          )}

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
                  <button type="button" onClick={() => setRejecting(false)} className="btn-secondary flex-1">
                    Άκυρο
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void transition(isNew ? "REJECTED" : "CANCELLED_BY_RESTAURANT", { reasonId, reasonText })
                    }
                    className="btn flex-1 bg-rust text-onrust disabled:opacity-60"
                  >
                    Επιβεβαίωση
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {isNew && (
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
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => printOrder(order)} className="btn-secondary">
                    Εκτύπωση
                  </button>
                  {isNew && (
                    <>
                      <button type="button" onClick={() => setRejecting(true)} disabled={busy} className="btn-secondary">
                        Απόρριψη
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={accept}
                        className="btn min-w-40 flex-1 bg-emerald-600 text-white disabled:opacity-60"
                      >
                        Αποδοχή & εκτύπωση
                      </button>
                    </>
                  )}
                  {canDeliver && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void transition("DELIVERED")}
                      className="btn-primary min-w-40 flex-1 disabled:opacity-60"
                    >
                      Παραδόθηκε
                    </button>
                  )}
                  {canCancel && (
                    <button type="button" onClick={() => setRejecting(true)} disabled={busy} className="btn-ghost text-sm text-rust">
                      Ακύρωση
                    </button>
                  )}
                </div>
              </div>
            )}

            {requiresReason(order.status) && order.lastReason && (
              <p className="mt-3 text-sm text-char/65">Λόγος: {order.lastReason}</p>
            )}
          </div>
        </Detail>
      )}
    </article>
  );
}

/** A window of its own for one order, so the list underneath never moves. */
function Detail({
  children,
  onClose,
  label,
}: {
  children: React.ReactNode;
  onClose: () => void;
  label: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Παραγγελία ${label}`}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[94svh] w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-3xl border border-line bg-sand shadow-lift sm:rounded-3xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Κλείσιμο"
          className="absolute right-3 top-3 z-10 inline-flex size-11 items-center justify-center rounded-full bg-black/25 text-2xl font-bold leading-none text-white"
        >
          ×
        </button>
        {children}
      </div>
    </div>,
    document.body,
  );
}
