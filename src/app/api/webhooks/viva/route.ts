import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { payments, PAYMENT_MODE } from "@/lib/payments";
import { transitionOrder } from "@/lib/order-service";
import { recordFiscalEvent } from "@/lib/viva-fiscalisation";
import { toCents } from "@/lib/money";
import { publishStaffEvent } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* ============================================================================
 *  PAYMENT WEBHOOK
 *
 *  This endpoint is the only thing between a forged HTTP request and free food.
 *  It never trusts the request body. `payments().verifyWebhook()` returns an
 *  event ONLY after:
 *
 *    1. the HMAC signature over the raw body matches (when a secret is set), and
 *    2. the transaction has been read back from the provider's own API with our
 *       credentials, with the amount and merchant reference taken from THAT
 *       response rather than from the caller.
 *
 *  Anything that fails either step comes back as null and is ignored.
 *
 *  On top of that, this handler enforces three things of its own:
 *    - idempotency, so a retry cannot double-refund
 *    - amount matching, so a real 1 EUR payment cannot release a 40 EUR order
 *    - the state machine, so an order can only be released from PENDING_PAYMENT
 *
 *  In mock mode the provider returns null for every webhook, so this endpoint
 *  is inert and cannot be used to release anything.
 * ========================================================================= */

/** Viva activates a webhook by GETting the URL and expecting the account key. */
export async function GET() {
  const key = payments().webhookActivationKey();
  if (!key) {
    return NextResponse.json(
      {
        error: "no_activation_key",
        paymentMode: PAYMENT_MODE,
        hint:
          PAYMENT_MODE === "mock"
            ? "Running in mock mode; no webhook is needed."
            : "Set VIVA_WEBHOOK_VERIFICATION_KEY.",
      },
      { status: 503 },
    );
  }
  return NextResponse.json({ Key: key });
}

export async function POST(req: Request) {
  // The raw body is needed byte-for-byte for the signature check; re-serialising
  // parsed JSON would change whitespace and break every signature.
  const rawBody = await req.text();

  const event = await payments().verifyWebhook(req, rawBody);
  if (!event) {
    // Not authentic, or mock mode. 200 so a misconfigured sender stops retrying,
    // but nothing whatsoever has been trusted.
    return NextResponse.json({ ok: true, ignored: "unverified" });
  }

  /* ---- idempotency ------------------------------------------------------ */
  try {
    await prisma.webhookEvent.create({
      data: {
        eventId: event.eventId,
        eventType: event.kind,
        payload: event.raw as Prisma.InputJsonValue,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error("[webhook] failed to record event", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  const order = await prisma.order.findUnique({
    where: { orderCode: event.merchantReference },
    include: { payments: true },
  });

  if (!order) {
    console.warn(`[webhook] no order for reference ${event.merchantReference}`);
    return NextResponse.json({ ok: true, ignored: "unknown_order" });
  }

  /* ---- refund ----------------------------------------------------------- */
  if (event.kind === "refund_created") {
    const known = await prisma.refund.findFirst({
      where: { vivaRefundReference: event.transactionId },
      select: { id: true },
    });
    if (!known) {
      await prisma.refund.create({
        data: {
          orderId: order.id,
          amount: new Prisma.Decimal((event.amountCents / 100).toFixed(2)),
          vivaRefundReference: event.transactionId,
          status: "completed",
          reason: "Refund reported by the payment provider",
        },
      });
    }
    return NextResponse.json({ ok: true, handled: "refund" });
  }

  /* ---- failure ---------------------------------------------------------- */
  if (event.kind === "payment_failed") {
    if (order.status === "PENDING_PAYMENT") {
      await prisma.payment.updateMany({
        where: { orderId: order.id, status: "pending" },
        data: { status: "failed", vivaTransactionId: event.transactionId },
      });
      await transitionOrder({
        orderId: order.id,
        to: "PAYMENT_FAILED",
        changedBy: "system",
        reason: "Payment provider reported a failure",
        expectedFrom: "PENDING_PAYMENT",
      });
    }
    return NextResponse.json({ ok: true, handled: "failure" });
  }

  /* ---- capture ---------------------------------------------------------- */
  const owedCents = toCents(order.totalAmount);

  if (event.amountCents < owedCents) {
    // Underpayment. Do NOT release the order; flag it for a human.
    console.error(
      `[webhook] UNDERPAYMENT on ${order.orderCode}: ${event.amountCents} of ${owedCents} cents`,
    );
    await prisma.payment.updateMany({
      where: { orderId: order.id, status: "pending" },
      data: { status: "amount_mismatch", vivaTransactionId: event.transactionId },
    });
    return NextResponse.json({ ok: true, handled: "amount_mismatch" });
  }

  await prisma.payment.updateMany({
    where: { orderId: order.id, status: "pending" },
    data: {
      status: "captured",
      vivaTransactionId: event.transactionId,
      confirmedAt: new Date(),
    },
  });

  const captured = await prisma.payment.count({
    where: { orderId: order.id, status: "captured" },
  });
  if (captured === 0) {
    await prisma.payment.create({
      data: {
        orderId: order.id,
        vivaTransactionId: event.transactionId,
        amount: new Prisma.Decimal((event.amountCents / 100).toFixed(2)),
        status: "captured",
        method: order.paymentMethod,
        confirmedAt: new Date(),
      },
    });
  }

  const result = await transitionOrder({
    orderId: order.id,
    to: "PAID_AWAITING_ACCEPTANCE",
    changedBy: "system",
    reason: null,
    expectedFrom: "PENDING_PAYMENT",
  });

  if (result.ok) {
    void publishStaffEvent({
      type: "new_order",
      orderId: order.id,
      orderCode: order.orderCode,
      status: "PAID_AWAITING_ACCEPTANCE",
      totalAmount: order.totalAmount.toString(),
      fulfillmentType: order.fulfillmentType,
      createdAt: order.createdAt.toISOString(),
    });
    await recordFiscalEvent({
      kind: "SALE",
      orderId: order.id,
      orderCode: order.orderCode,
      amountCents: event.amountCents,
      vivaTransactionId: event.transactionId,
    });
  } else if (result.error !== "already_in_state" && result.error !== "stale_state") {
    console.error(`[webhook] could not release ${order.orderCode}: ${result.error}`);
  }

  return NextResponse.json({ ok: true, handled: "payment" });
}
