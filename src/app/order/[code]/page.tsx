import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { isOrderCodeShape } from "@/lib/order-code";
import { CUSTOMER_CANCEL_GRACE_SECONDS } from "@/lib/brand";
import { publicOrderShape } from "@/lib/order-shape";
import type { OrderStatus } from "@/lib/order-status";
import OrderTracker, { type TrackedOrder } from "@/components/OrderTracker";

export const dynamic = "force-dynamic";

// The order code is a credential. Keeping this page out of search results is
// as important as keeping the code unguessable.
export const metadata: Metadata = {
  title: "Η παραγγελία σου",
  robots: { index: false, follow: false, nocache: true },
};

export default async function OrderPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const normalized = decodeURIComponent(code).toUpperCase();

  const order = isOrderCodeShape(normalized)
    ? await prisma.order.findUnique({
        where: { orderCode: normalized },
        select: { ...publicOrderShape, id: true },
      })
    : null;

  if (!order) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center sm:px-6">
        <h1 className="font-display text-3xl font-bold">404</h1>
        <p className="mt-3 text-char/70">
          Δεν βρέθηκε παραγγελία με αυτόν τον κωδικό.
        </p>
        <Link href="/menu" className="btn-primary mt-6">
          Παράγγειλε τώρα
        </Link>
      </div>
    );
  }

  const lastHistory = await prisma.orderStatusHistory.findFirst({
    where: { orderId: order.id, toStatus: order.status },
    orderBy: { createdAt: "desc" },
    select: { reason: true },
  });

  const ageSeconds = (Date.now() - order.createdAt.getTime()) / 1000;

  const initial: TrackedOrder = {
    orderCode: order.orderCode,
    status: order.status as OrderStatus,
    fulfillmentType: order.fulfillmentType as "delivery" | "pickup",
    etaMinutes: order.etaMinutes,
    etaConfirmedAt: order.etaConfirmedAt?.toISOString() ?? null,
    items: (order.items as TrackedOrder["items"]) ?? [],
    subtotalCents: Math.round(Number(order.subtotalAmount) * 100),
    deliveryFeeCents: Math.round(Number(order.deliveryFee) * 100),
    totalCents: Math.round(Number(order.totalAmount) * 100),
    paymentMethod: order.paymentMethod,
    customerFirstName: order.customerName.split(" ")[0] ?? "",
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    reason: lastHistory?.reason ?? null,
    cancellable:
      order.status === "PAID_AWAITING_ACCEPTANCE" &&
      ageSeconds <= CUSTOMER_CANCEL_GRACE_SECONDS,
    cancelWindowSecondsLeft: Math.max(
      0,
      Math.ceil(CUSTOMER_CANCEL_GRACE_SECONDS - ageSeconds),
    ),
  };

  return <OrderTracker initial={initial} />;
}
