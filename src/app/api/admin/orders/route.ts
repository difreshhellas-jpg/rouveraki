import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withStaff } from "@/lib/auth";
import { isOrderStatus, nextStatuses, type OrderStatus } from "@/lib/order-status";

export const dynamic = "force-dynamic";

/** Orders that are still someone's problem right now. */
const LIVE_STATUSES: OrderStatus[] = [
  "PAID_AWAITING_ACCEPTANCE",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "DISPATCHED",
];

/**
 * GET /api/admin/orders
 *   ?view=live      (default) everything still in flight, oldest first
 *   ?view=all       recent history, newest first
 *   ?status=READY   filter to one status
 *   ?limit=50
 */
export const GET = withStaff(async (req) => {
  const url = new URL(req.url);
  const view = url.searchParams.get("view") ?? "live";
  const statusParam = url.searchParams.get("status");
  const limit = Math.min(
    200,
    Math.max(1, Number(url.searchParams.get("limit") ?? 60) || 60),
  );

  const where =
    statusParam && isOrderStatus(statusParam)
      ? { status: statusParam }
      : view === "live"
        ? { status: { in: LIVE_STATUSES } }
        : {};

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: view === "live" ? "asc" : "desc" },
    take: limit,
    include: {
      payments: {
        select: { status: true, method: true, vivaTransactionId: true },
      },
      history: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { reason: true, changedBy: true, createdAt: true },
      },
    },
  });

  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      orderCode: o.orderCode,
      status: o.status,
      allowedNext: isOrderStatus(o.status) ? nextStatuses(o.status) : [],
      fulfillmentType: o.fulfillmentType,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      customerAddress: o.customerAddress,
      deliveryZone: o.deliveryZone,
      items: o.items,
      generalNotes: o.generalNotes,
      subtotalCents: Math.round(Number(o.subtotalAmount) * 100),
      deliveryFeeCents: Math.round(Number(o.deliveryFee) * 100),
      totalCents: Math.round(Number(o.totalAmount) * 100),
      paymentMethod: o.paymentMethod,
      paymentStatus: o.payments[0]?.status ?? null,
      ageVerified: o.ageVerified,
      etaMinutes: o.etaMinutes,
      etaConfirmedAt: o.etaConfirmedAt,
      lastReason: o.history[0]?.reason ?? null,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    })),
  });
});
