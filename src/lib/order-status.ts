/**
 * Order lifecycle (spec §4). This module is the single authority on what a legal
 * transition is; nothing else may write `orders.status` directly.
 *
 *  PENDING_PAYMENT → PAID_AWAITING_ACCEPTANCE → ACCEPTED → DELIVERED
 *
 * Two staff steps only: accept, then delivered (pickup and delivery alike).
 * PREPARING / READY / DISPATCHED / COMPLETED stay in the type for old rows but
 * nothing can move into them any more.
 */

export const ORDER_STATUSES = [
  "PENDING_PAYMENT",
  "PAID_AWAITING_ACCEPTANCE",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "DISPATCHED",
  "DELIVERED",
  "COMPLETED",
  "REJECTED",
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_RESTAURANT",
  "PAYMENT_FAILED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const isOrderStatus = (v: unknown): v is OrderStatus =>
  typeof v === "string" && (ORDER_STATUSES as readonly string[]).includes(v);

/** Allowed next states from each state. Empty array = terminal. */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID_AWAITING_ACCEPTANCE", "PAYMENT_FAILED", "CANCELLED_BY_CUSTOMER"],
  PAID_AWAITING_ACCEPTANCE: ["ACCEPTED", "REJECTED", "CANCELLED_BY_CUSTOMER"],
  ACCEPTED: ["DELIVERED", "CANCELLED_BY_RESTAURANT"],
  // Legacy states: orders already sitting here can still be finished.
  PREPARING: ["DELIVERED", "CANCELLED_BY_RESTAURANT"],
  READY: ["DELIVERED", "CANCELLED_BY_RESTAURANT"],
  DISPATCHED: ["DELIVERED"],
  DELIVERED: [],
  COMPLETED: [],
  REJECTED: [],
  CANCELLED_BY_CUSTOMER: [],
  CANCELLED_BY_RESTAURANT: [],
  PAYMENT_FAILED: [],
};

/** Transitions that must carry a reason (spec §4). */
const REASON_REQUIRED: readonly OrderStatus[] = [
  "REJECTED",
  "CANCELLED_BY_RESTAURANT",
];

/** Transitions that must trigger an automatic refund (spec §4). */
const AUTO_REFUND: readonly OrderStatus[] = [
  "REJECTED",
  "CANCELLED_BY_CUSTOMER",
  "CANCELLED_BY_RESTAURANT",
];

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean =>
  TRANSITIONS[from].includes(to);

export const nextStatuses = (from: OrderStatus): readonly OrderStatus[] =>
  TRANSITIONS[from];

export const requiresReason = (to: OrderStatus): boolean =>
  REASON_REQUIRED.includes(to);

export const triggersRefund = (to: OrderStatus): boolean =>
  AUTO_REFUND.includes(to);

export const isTerminal = (s: OrderStatus): boolean => TRANSITIONS[s].length === 0;

/** A cancelled/rejected/failed order, i.e. one that never reaches the customer. */
export const isUnsuccessful = (s: OrderStatus): boolean =>
  s === "REJECTED" ||
  s === "CANCELLED_BY_CUSTOMER" ||
  s === "CANCELLED_BY_RESTAURANT" ||
  s === "PAYMENT_FAILED";

/**
 * The happy-path steps shown on the customer tracking page, per fulfillment
 * type. PENDING_PAYMENT is omitted — the customer never sees the tracking page
 * before payment resolves.
 */
const TRACKING: OrderStatus[] = ["PAID_AWAITING_ACCEPTANCE", "ACCEPTED", "DELIVERED"];
export const trackingSteps = (_fulfillment: "delivery" | "pickup"): OrderStatus[] => TRACKING; // eslint-disable-line @typescript-eslint/no-unused-vars

/** Cash orders skip the payment step entirely and land straight in the queue. */
export const initialStatus = (paymentMethod: string): OrderStatus =>
  paymentMethod === "cash" ? "PAID_AWAITING_ACCEPTANCE" : "PENDING_PAYMENT";
