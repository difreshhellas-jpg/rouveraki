import "server-only";
import { kvGet, kvIndexAdd, kvIndexSince, kvMGet, kvSet } from "@/lib/kv";
import { z } from "zod";
import { generateOrderCode } from "@/lib/order-code";
import { codeToId } from "@/lib/order-id";
import { CUSTOMER_CANCEL_GRACE_SECONDS, DEFAULT_ETA_MINUTES } from "@/lib/brand";
import { canTransition, nextStatuses, type OrderStatus } from "@/lib/order-status";
import { normalizeGreekPhone } from "@/lib/sanitize";
import { loadLiveMenu } from "@/lib/menu-store";
import type { AdminOrder, AdminOrderItem } from "@/components/admin/useOrders";
import type { TrackedOrder } from "@/components/OrderTracker";

/**
 * Shared orders for demo mode, kept in a small key-value store (lib/kv.ts).
 *
 *   order:<CODE>      the whole order as JSON, status included (expires after 4 days)
 *   orders:index      sorted set of codes by time placed, for the shop screen
 *
 * A status change re-reads the order, checks it is still in the state the
 * screen saw (expectedFrom) and writes it back, so two taps at once cannot
 * push an order through an illegal step.
 */

type Stored = Omit<AdminOrder, "allowedNext">;

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number; extra?: Record<string, unknown> };

const TTL = 4 * 86_400;
const key = (code: string) => `order:${code.toUpperCase()}`;

async function findOrder(code: string): Promise<Stored | null> {
  return kvGet<Stored>(key(code));
}

async function recent(days: number): Promise<Stored[]> {
  const codes = await kvIndexSince("orders:index", Date.now() - days * 86_400_000);
  const rows = await kvMGet<Stored>(codes.map(key));
  return rows.filter((o): o is Stored => Boolean(o));
}

/* ---- shapes -------------------------------------------------------------- */

const toAdmin = (o: Stored): AdminOrder => ({ ...o, allowedNext: [...nextStatuses(o.status)] });

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
    cancellable: o.status === "PAID_AWAITING_ACCEPTANCE" && ageSeconds <= CUSTOMER_CANCEL_GRACE_SECONDS,
    cancelWindowSecondsLeft: Math.max(0, Math.ceil(CUSTOMER_CANCEL_GRACE_SECONDS - ageSeconds)),
  };
};

/* ---- operations ---------------------------------------------------------- */

export const PlaceInput = z.object({
  lines: z
    .array(
      z.object({
        menuItemId: z.number().int().positive(),
        quantity: z.number().int().min(1).max(30),
        itemNotes: z.string().max(200).optional(),
        unitPriceCents: z.number().int().min(0).optional(),
      }),
    )
    .min(1)
    .max(60),
  fulfillmentType: z.enum(["delivery", "pickup"]),
  customerName: z.string().trim().min(1).max(120),
  customerPhone: z.string().trim().min(1).max(30),
  customerAddress: z.string().trim().max(300).nullable().optional(),
  generalNotes: z.string().trim().max(400).nullable().optional(),
  paymentMethod: z.enum(["cash", "card"]),
});

export async function placeOrder(input: z.infer<typeof PlaceInput>): Promise<Result<{ orderCode: string; trackingUrl: string }>> {
  if (!normalizeGreekPhone(input.customerPhone)) return { ok: false, error: "invalid_phone" };
  if (input.fulfillmentType === "delivery" && !input.customerAddress?.trim()) {
    return { ok: false, error: "address_required" };
  }

  const menu = await loadLiveMenu({ strict: true });
  const byId = new Map(menu.map((m) => [m.id, m]));
  let subtotalCents = 0;
  let maxPrep = 0;
  const items: AdminOrderItem[] = [];
  for (const l of input.lines) {
    const m = byId.get(l.menuItemId);
    if (!m) return { ok: false, error: "unknown_menu_item" };
    if (!m.available) return { ok: false, error: "item_unavailable", extra: { name: m.name } };
    // Never charge at the door a different amount from the one shown at checkout.
    if (l.unitPriceCents !== undefined && l.unitPriceCents !== m.priceCents) {
      return { ok: false, error: "price_changed", extra: { name: m.name } };
    }
    subtotalCents += m.priceCents * l.quantity;
    maxPrep = Math.max(maxPrep, m.prepTimeMinutes);
    items.push({
      menu_item_id: m.id,
      name: m.name,
      name_en: m.nameEn,
      unit_price_cents: m.priceCents,
      quantity: l.quantity,
      item_notes: (l.itemNotes ?? "").trim(),
      category: m.category,
    });
  }

  const orderCode = generateOrderCode();
  const now = new Date().toISOString();
  const order: Stored = {
    id: codeToId(orderCode),
    orderCode,
    // Paid at the door, so every order goes straight into the shop's queue.
    status: "PAID_AWAITING_ACCEPTANCE",
    fulfillmentType: input.fulfillmentType,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerAddress: input.fulfillmentType === "delivery" ? (input.customerAddress ?? null) : null,
    deliveryZone: null,
    items,
    generalNotes: input.generalNotes || null,
    subtotalCents,
    deliveryFeeCents: 0,
    totalCents: subtotalCents,
    paymentMethod: input.paymentMethod,
    paymentStatus: null,
    ageVerified: false,
    etaMinutes: DEFAULT_ETA_MINUTES[input.fulfillmentType] + Math.max(0, maxPrep - 10),
    etaConfirmedAt: now,
    lastReason: null,
    createdAt: now,
    updatedAt: now,
  };
  await kvSet(key(orderCode), order, TTL);
  await kvIndexAdd("orders:index", orderCode, Date.now());
  return { ok: true, data: { orderCode, trackingUrl: `/order/${orderCode}` } };
}

export async function getTracked(code: string): Promise<TrackedOrder | null> {
  const o = await findOrder(code);
  return o ? toTracked(o) : null;
}

const DONE: OrderStatus[] = [
  "DELIVERED",
  "COMPLETED",
  "REJECTED",
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_RESTAURANT",
  "PAYMENT_FAILED",
];

export async function listAdmin(view: "live" | "all"): Promise<AdminOrder[]> {
  return (await recent(view === "all" ? 3 : 2))
    .filter((o) => view === "all" || !DONE.includes(o.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toAdmin);
}

export async function transition(
  code: string,
  to: OrderStatus,
  extra: { expectedFrom?: OrderStatus; etaMinutes?: number; reasonText?: string } = {},
): Promise<Result<null>> {
  const o = await findOrder(code);
  if (!o) return { ok: false, error: "not_found", status: 404 };
  if (extra.expectedFrom && extra.expectedFrom !== o.status) {
    return { ok: false, error: "stale_state", status: 409 };
  }
  if (!canTransition(o.status, to)) return { ok: false, error: "illegal_transition" };

  const at = new Date().toISOString();
  const next: Stored = {
    ...o,
    status: to,
    updatedAt: at,
    lastReason: extra.reasonText?.trim().slice(0, 300) || null,
  };
  if (extra.etaMinutes) {
    next.etaMinutes = Math.min(240, Math.max(1, Math.round(extra.etaMinutes)));
    next.etaConfirmedAt = at;
  }
  await kvSet(key(o.orderCode), next, TTL);
  return { ok: true, data: null };
}

export async function cancelByCustomer(code: string): Promise<Result<null>> {
  const o = await findOrder(code);
  if (!o) return { ok: false, error: "not_found", status: 404 };
  if (!toTracked(o).cancellable) return { ok: false, error: "cancel_window_closed" };
  return transition(code, "CANCELLED_BY_CUSTOMER", { expectedFrom: o.status });
}
