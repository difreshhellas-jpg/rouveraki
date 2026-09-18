import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isOrderCodeShape } from "@/lib/order-code";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { transitionOrder } from "@/lib/order-service";
import { CUSTOMER_CANCEL_GRACE_SECONDS } from "@/lib/brand";

export const dynamic = "force-dynamic";

/**
 * Customer self-cancellation (spec §4: grace window only, before ACCEPTED).
 *
 * The window is enforced here, on the server clock. The tracking page hides the
 * button once it expires, but that is a courtesy — this is the check that counts.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const normalized = code.toUpperCase();

  if (!isOrderCodeShape(normalized)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const limit = rateLimit(`order:cancel:${clientIp(req)}`, 10, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const order = await prisma.order.findUnique({
    where: { orderCode: normalized },
    select: { id: true, status: true, createdAt: true },
  });

  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const ageSeconds = (Date.now() - order.createdAt.getTime()) / 1000;
  if (ageSeconds > CUSTOMER_CANCEL_GRACE_SECONDS) {
    return NextResponse.json({ error: "window_closed" }, { status: 409 });
  }

  const result = await transitionOrder({
    orderId: order.id,
    to: "CANCELLED_BY_CUSTOMER",
    changedBy: "customer",
    reason: "Ακύρωση από τον πελάτη εντός του χρόνου χάριτος",
    expectedFrom: order.status as never,
  });

  if (!result.ok) {
    const status =
      result.error === "illegal_transition" || result.error === "stale_state"
        ? 409
        : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, status: result.to });
}
