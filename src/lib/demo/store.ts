"use client";

/**
 * Demo-mode "backend": orders live in this browser's localStorage and every
 * route the real API offers is answered here. Nothing leaves the device and no
 * card or bank data is ever read or stored.
 *
 * Shapes mirror the real API responses so the existing screens run unchanged.
 */
import menu from "@/data/menu.json";
import { generateOrderCode } from "@/lib/order-code";
import {
  zoneById,
  DEFAULT_ETA_MINUTES,
  CUSTOMER_CANCEL_GRACE_SECONDS,
} from "@/lib/brand";
import {
  canTransition,
  nextStatuses,
  type OrderStatus,
} from "@/lib/order-status";
import type { MenuItemDTO } from "@/lib/menu-types";
import type { TrackedOrder } from "@/components/OrderTracker";
import type { AdminOrder, AdminOrderItem } from "@/components/admin/useOrders";

const KEY = "rouveraki-demo-orders-v1";
const CHANNEL = "rouveraki-demo";

type Stored = Omit<AdminOrder, "allowedNext">;

export const demoMenu = (): MenuItemDTO[] => menu.items as MenuItemDTO[];

/* ---- storage ------------------------------------------------------------ */

const read = (): Stored[] => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored[]) : [];
  } catch {
    return [];
  }
};

let bc: BroadcastChannel | null = null;
const channel = () => {
  if (bc || typeof BroadcastChannel === "undefined") return bc;
  bc = new BroadcastChannel(CHANNEL);
  return bc;
};

const write = (orders: Stored[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(orders));
  } catch {
    /* private mode / quota: nothing more the demo can do */
  }
  channel()?.postMessage("changed");
};

/** Calls `cb` when ANOTHER tab changes the demo orders. */
export function onDemoChange(cb: () => void): () => void {
  const ch = channel();
  const onMsg = () => cb();
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  ch?.addEventListener("message", onMsg);
  window.addEventListener("storage", onStorage);
  return () => {
    ch?.removeEventListener("message", onMsg);
    window.removeEventListener("storage", onStorage);
  };
}

export function clearDemoOrders() {
  write([]);
}

/* ---- shapes ------------------------------------------------------------- */

const toAdmin = (o: Stored): AdminOrder => ({
  ...o,
  allowedNext: [...nextStatuses(o.status)],
});

const toTracked = (o: Stored): TrackedOrder => {
  const ageSeconds = (Date.now() - new Date(o.createdAt).getTime()) / 1000;
  return {
    orderCode: o.orderCode,
    status: o.status,
    fulfillmentType: o.fulfillmentType,
    etaMinutes: o.etaMinutes,
    etaConfirmedAt: o.etaConfirmedAt,
    items: o.items,
    subtotalCents: o.subtotalCents,
    deliveryFeeCents: o.deliveryFeeCents,
    totalCents: o.totalCents,
    paymentMethod: o.paymentMethod,
    customerFirstName: o.customerName.split(" ")[0] ?? "",
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    reason: o.lastReason,
    cancellable:
      o.status === "PAID_AWAITING_ACCEPTANCE" &&
      ageSeconds <= CUSTOMER_CANCEL_GRACE_SECONDS,
    cancelWindowSecondsLeft: Math.max(
      0,
      Math.ceil(CUSTOMER_CANCEL_GRACE_SECONDS - ageSeconds),
    ),
  };
};

/* ---- operations --------------------------------------------------------- */

export type PlaceInput = {
  lines: { menuItemId: number; quantity: number; itemNotes?: string }[];
  fulfillmentType: "delivery" | "pickup";
  customerName: string;
  customerPhone: string;
  customerAddress: string | null;
  deliveryZone: string | null;
  generalNotes: string | null;
  paymentMethod: "iris" | "card" | "cash";
  ageVerified: boolean;
};

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; extra?: Record<string, unknown> };

export function placeOrder(
  input: PlaceInput,
): Result<{ orderCode: string; trackingUrl: string }> {
  const byId = new Map(demoMenu().map((m) => [m.id, m]));
  let subtotalCents = 0;
  let maxPrep = 0;
  const items: AdminOrderItem[] = [];
  for (const l of input.lines) {
    const m = byId.get(l.menuItemId);
    if (!m) return { ok: false, error: "unknown_menu_item" };
    subtotalCents += m.priceCents * l.quantity;
    maxPrep = Math.max(maxPrep, m.prepTimeMinutes);
    items.push({
      menu_item_id: m.id,
      name: m.name,
      name_en: m.nameEn,
      unit_price_cents: m.priceCents,
      quantity: l.quantity,
      item_notes: (l.itemNotes ?? "").slice(0, 200),
      category: m.category,
    });
  }

  const zone =
    input.fulfillmentType === "delivery"
      ? zoneById(input.deliveryZone ?? "")
      : undefined;
  if (input.fulfillmentType === "delivery" && !zone) {
    return { ok: false, error: "invalid_zone" };
  }
  const deliveryFeeCents = zone ? Math.round(zone.deliveryFee * 100) : 0;
  const minimumCents = zone ? Math.round(zone.minimumOrder * 100) : 0;
  if (subtotalCents < minimumCents) {
    return { ok: false, error: "below_minimum", extra: { minimumCents } };
  }

  const now = new Date().toISOString();
  const orders = read();
  let orderCode = generateOrderCode();
  while (orders.some((o) => o.orderCode === orderCode)) {
    orderCode = generateOrderCode();
  }

  // The demo payment step always succeeds, so every order goes straight into
  // the shop's queue (the real flow starts card/IRIS at PENDING_PAYMENT).
  orders.push({
    id: Math.max(0, ...orders.map((o) => o.id)) + 1,
    orderCode,
    status: "PAID_AWAITING_ACCEPTANCE",
    fulfillmentType: input.fulfillmentType,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerAddress: input.customerAddress,
    deliveryZone: zone?.id ?? null,
    items,
    generalNotes: input.generalNotes,
    subtotalCents,
    deliveryFeeCents,
    totalCents: subtotalCents + deliveryFeeCents,
    paymentMethod: input.paymentMethod,
    paymentStatus: input.paymentMethod === "cash" ? null : "demo",
    ageVerified: input.ageVerified,
    etaMinutes:
      DEFAULT_ETA_MINUTES[input.fulfillmentType] + Math.max(0, maxPrep - 10),
    // Shown on the confirmation screen straight away so it reads as a real ETA.
    etaConfirmedAt: now,
    lastReason: null,
    createdAt: now,
    updatedAt: now,
  });
  write(orders);
  return { ok: true, data: { orderCode, trackingUrl: `/order/${orderCode}` } };
}

export const getTracked = (code: string): TrackedOrder | null => {
  const o = read().find((x) => x.orderCode === code.toUpperCase());
  return o ? toTracked(o) : null;
};

export const listAdmin = (view: "live" | "all"): AdminOrder[] => {
  const done: OrderStatus[] = [
    "DELIVERED",
    "COMPLETED",
    "REJECTED",
    "CANCELLED_BY_CUSTOMER",
    "CANCELLED_BY_RESTAURANT",
    "PAYMENT_FAILED",
  ];
  return read()
    .filter((o) => view === "all" || !done.includes(o.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toAdmin);
};

export function transition(
  id: number,
  to: OrderStatus,
  extra: { expectedFrom?: OrderStatus; etaMinutes?: number; reasonText?: string } = {},
): Result<null> {
  const orders = read();
  const o = orders.find((x) => x.id === id);
  if (!o) return { ok: false, error: "not_found" };
  if (extra.expectedFrom && extra.expectedFrom !== o.status) {
    return { ok: false, error: "stale_state" };
  }
  if (!canTransition(o.status, to)) {
    return { ok: false, error: "illegal_transition" };
  }
  o.status = to;
  o.updatedAt = new Date().toISOString();
  if (extra.etaMinutes) {
    o.etaMinutes = extra.etaMinutes;
    o.etaConfirmedAt = o.updatedAt;
  }
  o.lastReason = extra.reasonText?.trim() || null;
  write(orders);
  return { ok: true, data: null };
}

export function cancelByCustomer(code: string): Result<null> {
  const o = read().find((x) => x.orderCode === code.toUpperCase());
  if (!o) return { ok: false, error: "not_found" };
  if (!toTracked(o).cancellable) {
    return { ok: false, error: "cancel_window_closed" };
  }
  return transition(o.id, "CANCELLED_BY_CUSTOMER");
}
