"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { AdminOrder } from "./useOrders";
import { formatEuro } from "@/lib/money";
import { BRAND, zoneById } from "@/lib/brand";
import { DEMO_MODE } from "@/lib/demo/config";

/** Demo orders are paid at the door, so "card" tells the driver to take the POS. */
const PAY_LABEL: Record<string, string> = {
  cash: "ΜΕΤΡΗΤΑ",
  card: DEMO_MODE ? "ΚΑΡΤΑ (POS)" : "ΚΑΡΤΑ",
};

/**
 * One order as an 80 mm receipt-printer ticket.
 *
 * Rendered into <body> only while printing; the `printing-ticket` class on
 * <body> makes the print stylesheet hide everything else, so the browser's
 * print dialog sees this ticket alone (works on a tablet, where popups don't).
 */
const PRINT_EVENT = "rouveraki:print";

/** Ask the page's <PrintHost /> to print this order's ticket right now. */
export function printOrder(order: AdminOrder) {
  window.dispatchEvent(new CustomEvent<AdminOrder>(PRINT_EVENT, { detail: order }));
}

/**
 * Mount once per screen. Printing lives here rather than in each order card, so
 * a card moving to another column (or the list refreshing) cannot cancel a
 * print that is already on its way.
 */
export function PrintHost() {
  const [order, setOrder] = useState<AdminOrder | null>(null);

  useEffect(() => {
    const onPrint = (e: Event) => setOrder((e as CustomEvent<AdminOrder>).detail);
    window.addEventListener(PRINT_EVENT, onPrint);
    return () => window.removeEventListener(PRINT_EVENT, onPrint);
  }, []);

  useEffect(() => {
    if (!order) return;
    document.body.classList.add("printing-ticket");
    const done = () => setOrder(null);
    window.addEventListener("afterprint", done);
    // Let the portal paint before the dialog snapshots the page.
    const raf = requestAnimationFrame(() => window.print());
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("afterprint", done);
      document.body.classList.remove("printing-ticket");
    };
  }, [order]);

  return order ? createPortal(<Ticket order={order} />, document.body) : null;
}

function Ticket({ order }: { order: AdminOrder }) {
  const money = (c: number) => formatEuro(c / 100, "el-GR");
  const created = new Date(order.createdAt).toLocaleString("el-GR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="print-ticket">
      <p className="pt-center pt-bold pt-lg">{BRAND.nameEl}</p>
      <p className="pt-center">
        {BRAND.address.street}, {BRAND.address.city} · {BRAND.phone.display}
      </p>
      <hr />
      <p className="pt-center pt-bold pt-xl">{order.orderCode}</p>
      <p className="pt-center pt-bold">
        {order.fulfillmentType === "delivery" ? "ΔΙΑΝΟΜΗ" : "ΠΑΡΑΛΑΒΗ"}
      </p>
      <p className="pt-center">
        {created}
        {order.etaMinutes ? ` · ETA ${order.etaMinutes}′` : ""}
      </p>
      <hr />
      <table>
        <tbody>
          {order.items.map((it, i) => (
            <tr key={`${it.menu_item_id}-${i}`}>
              <td className="pt-bold">{it.quantity}×</td>
              <td>
                {it.name}
                {it.item_notes && <div className="pt-bold">» {it.item_notes}</div>}
              </td>
              <td className="pt-right">{money(it.unit_price_cents * it.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {order.generalNotes && (
        <>
          <hr />
          <p className="pt-bold">Σημείωση: {order.generalNotes}</p>
        </>
      )}
      <hr />
      <table>
        <tbody>
          <tr>
            <td>Υποσύνολο</td>
            <td className="pt-right">{money(order.subtotalCents)}</td>
          </tr>
          {order.deliveryFeeCents > 0 && (
            <tr>
              <td>Έξοδα διανομής</td>
              <td className="pt-right">{money(order.deliveryFeeCents)}</td>
            </tr>
          )}
          <tr className="pt-bold pt-lg">
            <td>ΣΥΝΟΛΟ</td>
            <td className="pt-right">{money(order.totalCents)}</td>
          </tr>
        </tbody>
      </table>
      <p>
        Πληρωμή: {PAY_LABEL[order.paymentMethod] ?? order.paymentMethod.toUpperCase()}
        {order.paymentStatus ? ` (${order.paymentStatus})` : ""}
      </p>
      <hr />
      <p className="pt-bold">{order.customerName}</p>
      <p>{order.customerPhone}</p>
      {order.customerAddress && (
        <p>
          {order.customerAddress}
          {order.deliveryZone &&
            ` · ${zoneById(order.deliveryZone)?.el ?? order.deliveryZone}`}
        </p>
      )}
      <p className="pt-center pt-small">Δεν αποτελεί φορολογικό παραστατικό</p>
    </div>
  );
}
