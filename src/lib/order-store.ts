import "server-only";
import { list, put } from "@vercel/blob";
import { z } from "zod";
import { generateOrderCode } from "@/lib/order-code";
import { codeToId } from "@/lib/order-id";
import { CUSTOMER_CANCEL_GRACE_SECONDS, DEFAULT_ETA_MINUTES } from "@/lib/brand";
import { canTransition, nextStatuses, type OrderStatus, isOrderStatus } from "@/lib/order-status";
import { normalizeGreekPhone } from "@/lib/sanitize";
import { loadLiveMenu } from "@/lib/menu-store";
import type { AdminOrder, AdminOrderItem } from "@/components/admin/useOrders";
import type { TrackedOrder } from "@/components/OrderTracker";

/**
 * Shared orders for demo mode, kept in the same Vercel Blob store as the menu.
 *
 * Every file is written once and never overwritten, which sidesteps Blob's
 * few-second stale reads after an overwrite and makes two customers ordering
 * at the same moment harmless:
 *
 *   orders/<day>/<CODE>/a-order.json              the order as placed
 *   orders/<day>/<CODE>/e-<ms>-<STATUS>.json      one file per status change
 *
 * The current state is the order replayed through its events. Blob adds a
 * random suffix to every name, so the public URLs cannot be guessed; only the
 * server (which holds the token) can list them. <day> is the UTC date the
 * order was placed; the shop screen and tracking look at today and yesterday.
 */

type Stored = Omit<AdminOrder, "allowedNext">;
type Event = { status: OrderStatus; at: string; etaMinutes?: number; reasonText?: string };

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number; extra?: Record<string, unknown> };

const day = (offsetDays = 0) =>
  new Date(Date.now() - offsetDays * 86_400_000).toISOString().slice(0, 10);

/* ---- reading ------------------------------------------------------------- */

/** Files never change once written, so their contents are cached for good. */
const contents = new Map<string, unknown>();

async function readJson<T>(url: string): Promise<T> {
  if (!contents.has(url)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`order_read_${res.status}`);
    contents.set(url, await res.json());
  }
  return contents.get(url) as T;
}

async function listAll(prefix: string) {
  const blobs: { pathname: string; url: string }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

async function build(blobs: { pathname: string; url: string }[]): Promise<Stored[]> {
  const byCode = new Map<string, { order?: string; events: { pathname: string; url: string }[] }>();
  for (const b of blobs) {
    const [, , code, file] = b.pathname.split("/");
    if (!code || !file) continue;
    const entry = byCode.get(code) ?? { events: [] };
    if (file.startsWith("a-order")) entry.order = b.url;
    else if (file.startsWith("e-")) entry.events.push(b);
    byCode.set(code, entry);
  }

  const out: Stored[] = [];
  for (const entry of byCode.values()) {
    if (!entry.order) continue;
    const o = { ...(await readJson<Stored>(entry.order)) };
    // e-<ms>-... sorts by time; a change that is not allowed from the state
    // reached so far (e.g. a double tap) is skipped, not applied.
    const events = [...entry.events].sort((a, b) => a.pathname.localeCompare(b.pathname));
    for (const e of events) {
      const ev = await readJson<Event>(e.url);
      if (!isOrderStatus(ev.status) || !canTransition(o.status, ev.status)) continue;
      o.status = ev.status;
      o.updatedAt = ev.at;
      if (ev.etaMinutes) {
        o.etaMinutes = ev.etaMinutes;
        o.etaConfirmedAt = ev.at;
      }
      o.lastReason = ev.reasonText?.trim() || null;
    }
    out.push(o);
  }
  return out;
}

async function findOrder(code: string): Promise<Stored | null> {
  const c = code.toUpperCase();
  for (const d of [day(0), day(1)]) {
    const blobs = await listAll(`orders/${d}/${c}/`);
    if (blobs.length) return (await build(blobs))[0] ?? null;
  }
  return null;
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
  await put(`orders/${day()}/${orderCode}/a-order.json`, JSON.stringify(order), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: true,
  });
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
  const days = view === "all" ? [0, 1, 2] : [0, 1];
  const blobs = (await Promise.all(days.map((d) => listAll(`orders/${day(d)}/`)))).flat();
  return (await build(blobs))
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
  const event: Event = {
    status: to,
    at,
    ...(extra.etaMinutes ? { etaMinutes: Math.min(240, Math.max(1, Math.round(extra.etaMinutes))) } : {}),
    ...(extra.reasonText?.trim() ? { reasonText: extra.reasonText.trim().slice(0, 300) } : {}),
  };
  const placedDay = o.createdAt.slice(0, 10);
  await put(`orders/${placedDay}/${o.orderCode}/e-${Date.now()}-${to}.json`, JSON.stringify(event), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: true,
  });
  return { ok: true, data: null };
}

export async function cancelByCustomer(code: string): Promise<Result<null>> {
  const o = await findOrder(code);
  if (!o) return { ok: false, error: "not_found", status: 404 };
  if (!toTracked(o).cancellable) return { ok: false, error: "cancel_window_closed" };
  return transition(code, "CANCELLED_BY_CUSTOMER", { expectedFrom: o.status });
}
