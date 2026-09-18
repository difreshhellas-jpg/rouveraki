import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import {
  canTransition,
  isOrderStatus,
  requiresReason,
  triggersRefund,
  type OrderStatus,
} from "./order-status";
import { publishOrderUpdate, publishStaffEvent } from "./realtime";
import { sendOrderStatusSms } from "./sms";
import { payments } from "./payments";
import { recordFiscalEvent } from "./viva-fiscalisation";
import { toCents } from "./money";

/**
 * The ONLY place `orders.status` is written. Every caller goes through here so
 * that the transition check, the history row, the refund, the SMS and the
 * realtime push can never drift apart.
 */

export type TransitionInput = {
  orderId: number;
  to: OrderStatus;
  changedBy: string;
  reason?: string | null;
  /** Set when accepting: confirms the ETA shown to the customer. */
  etaMinutes?: number | null;
  /** Guard: only transition if the order is currently in this state. */
  expectedFrom?: OrderStatus;
};

export type TransitionResult =
  | { ok: true; from: OrderStatus; to: OrderStatus; orderCode: string }
  | { ok: false; error: string; currentStatus?: OrderStatus };

export async function transitionOrder(
  input: TransitionInput,
): Promise<TransitionResult> {
  const { orderId, to, changedBy } = input;
  const reason = input.reason?.trim() || null;

  if (!isOrderStatus(to)) return { ok: false, error: "invalid_status" };
  if (requiresReason(to) && !reason) return { ok: false, error: "reason_required" };

  /**
   * The read, the legality check and the write happen inside one transaction
   * with a conditional updateMany, so two staff members tapping "Accept" at the
   * same moment cannot both win. The second one's updateMany matches 0 rows.
   */
  let committed:
    | {
        from: OrderStatus;
        orderCode: string;
        phone: string;
        fulfillmentType: string;
        etaMinutes: number | null;
        totalAmount: Prisma.Decimal;
        createdAt: Date;
        updatedAt: Date;
      }
    | null = null;

  try {
    committed = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new OrderError("not_found");

      const from = order.status as OrderStatus;
      if (!isOrderStatus(from)) throw new OrderError("corrupt_status");
      if (input.expectedFrom && input.expectedFrom !== from) {
        throw new OrderError("stale_state", from);
      }
      if (from === to) throw new OrderError("already_in_state", from);
      if (!canTransition(from, to)) throw new OrderError("illegal_transition", from);

      const data: Prisma.OrderUpdateManyMutationInput = { status: to };
      if (to === "ACCEPTED") {
        data.etaMinutes = input.etaMinutes ?? order.etaMinutes ?? null;
        data.etaConfirmedAt = new Date();
      }

      const updated = await tx.order.updateMany({
        where: { id: orderId, status: from },
        data,
      });
      if (updated.count !== 1) throw new OrderError("stale_state", from);

      await tx.orderStatusHistory.create({
        data: { orderId, fromStatus: from, toStatus: to, changedBy, reason },
      });

      const fresh = await tx.order.findUniqueOrThrow({ where: { id: orderId } });

      return {
        from,
        orderCode: fresh.orderCode,
        phone: fresh.customerPhone,
        fulfillmentType: fresh.fulfillmentType,
        etaMinutes: fresh.etaMinutes,
        totalAmount: fresh.totalAmount,
        createdAt: fresh.createdAt,
        updatedAt: fresh.updatedAt,
      };
    });
  } catch (e) {
    if (e instanceof OrderError) {
      return { ok: false, error: e.code, currentStatus: e.currentStatus };
    }
    console.error("[order-service] transition failed", e);
    return { ok: false, error: "internal_error" };
  }

  // --- side effects, all after the commit, none able to undo it -------------
  const c = committed;

  if (triggersRefund(to)) {
    // Fire and forget with its own error handling; a refund failure is loud in
    // the logs and recoverable by hand, but must not leave the order mid-state.
    void issueRefund(orderId, reason).catch((e) =>
      console.error("[order-service] refund failed", orderId, e),
    );
  }

  void publishOrderUpdate({
    orderCode: c.orderCode,
    status: to,
    etaMinutes: c.etaMinutes,
    reason,
    updatedAt: c.updatedAt.toISOString(),
  });

  void publishStaffEvent({
    type: "status_changed",
    orderId,
    orderCode: c.orderCode,
    status: to,
    totalAmount: c.totalAmount.toString(),
    fulfillmentType: c.fulfillmentType,
    createdAt: c.createdAt.toISOString(),
  });

  void sendOrderStatusSms(to, {
    orderCode: c.orderCode,
    phone: c.phone,
    etaMinutes: c.etaMinutes,
    fulfillmentType: c.fulfillmentType,
    reason,
  });

  return { ok: true, from: c.from, to, orderCode: c.orderCode };
}

class OrderError extends Error {
  constructor(
    public code: string,
    public currentStatus?: OrderStatus,
  ) {
    super(code);
  }
}

/* -------------------------------------------------------------------------- */

/**
 * Refunds every captured payment on an order. Cash orders have nothing to
 * refund and are skipped without an error.
 */
export async function issueRefund(
  orderId: number,
  reason: string | null,
): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: true, refunds: true },
  });
  if (!order) return;
  if (order.paymentMethod === "cash") return;

  const alreadyRefunded = order.refunds
    .filter((r) => r.status === "completed")
    .reduce((n, r) => n + toCents(r.amount), 0);

  for (const payment of order.payments) {
    if (payment.status !== "captured" || !payment.vivaTransactionId) continue;

    const outstanding = toCents(payment.amount) - alreadyRefunded;
    if (outstanding <= 0) continue;

    const refundRow = await prisma.refund.create({
      data: {
        orderId,
        amount: payment.amount,
        status: "pending",
        reason,
      },
    });

    // Same call in both modes. The mock provider records the reversal without
    // a network call; the live provider reverses the real transaction.
    const result = await payments().refundPayment(
      payment.vivaTransactionId,
      outstanding,
    );

    await prisma.refund.update({
      where: { id: refundRow.id },
      data: {
        status: result.ok ? "completed" : "failed",
        vivaRefundReference: result.reference ?? null,
      },
    });

    if (!result.ok) {
      console.error(
        `[refund] order ${order.orderCode} refund FAILED: ${result.error} — needs manual action in the Viva dashboard`,
      );
      continue;
    }

    // Part 2: the matching credit note still has to be issued.
    await recordFiscalEvent({
      kind: "REFUND",
      orderId,
      orderCode: order.orderCode,
      amountCents: outstanding,
      vivaRefundReference: result.reference,
    });
  }
}

/* -------------------------------------------------------------------------- */

export { publicOrderShape } from "./order-shape";
