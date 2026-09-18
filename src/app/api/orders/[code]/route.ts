import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isOrderCodeShape } from "@/lib/order-code";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { publicOrderShape } from "@/lib/order-shape";
import { CUSTOMER_CANCEL_GRACE_SECONDS } from "@/lib/brand";

export const dynamic = "force-dynamic";

/**
 * Customer-facing order lookup. The order code is the only credential, so:
 *   - it is random and unguessable (see lib/order-code.ts)
 *   - lookups are rate limited, so the code space cannot be walked
 *   - the response carries no address, no phone and no other customer's data
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const normalized = code.toUpperCase();

  if (!isOrderCodeShape(normalized)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const limit = rateLimit(`order:lookup:${clientIp(req)}`, 60, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const order = await prisma.order.findUnique({
    where: { orderCode: normalized },
    select: { ...publicOrderShape, id: true },
  });

  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // The reason attached to the transition into the *current* status, so a
  // rejected order can explain itself. Scoped to this order id — without that
  // scope this would return some other customer's rejection note.
  const lastHistory = await prisma.orderStatusHistory.findFirst({
    where: { orderId: order.id, toStatus: order.status },
    orderBy: { createdAt: "desc" },
    select: { reason: true },
  });

  const ageSeconds = (Date.now() - order.createdAt.getTime()) / 1000;

  return NextResponse.json(
    {
      order: {
        orderCode: order.orderCode,
        status: order.status,
        fulfillmentType: order.fulfillmentType,
        etaMinutes: order.etaMinutes,
        etaConfirmedAt: order.etaConfirmedAt,
        items: order.items,
        subtotalCents: Math.round(Number(order.subtotalAmount) * 100),
        deliveryFeeCents: Math.round(Number(order.deliveryFee) * 100),
        totalCents: Math.round(Number(order.totalAmount) * 100),
        paymentMethod: order.paymentMethod,
        customerFirstName: order.customerName.split(" ")[0] ?? "",
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        reason: lastHistory?.reason ?? null,
        cancellable:
          order.status === "PAID_AWAITING_ACCEPTANCE" &&
          ageSeconds <= CUSTOMER_CANCEL_GRACE_SECONDS,
        cancelWindowSecondsLeft: Math.max(
          0,
          Math.ceil(CUSTOMER_CANCEL_GRACE_SECONDS - ageSeconds),
        ),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
