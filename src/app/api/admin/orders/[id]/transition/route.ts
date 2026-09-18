import { NextResponse } from "next/server";
import { z } from "zod";
import { withStaff } from "@/lib/auth";
import { transitionOrder } from "@/lib/order-service";
import { ORDER_STATUSES, isOrderStatus } from "@/lib/order-status";
import { REJECTION_REASONS } from "@/lib/brand";
import { sanitizeText } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

const statuses = ORDER_STATUSES as unknown as [string, ...string[]];

const BodySchema = z
  .object({
    to: z.enum(statuses),
    /** Guards against acting on a screen that has gone stale. */
    expectedFrom: z.enum(statuses).optional(),
    reasonId: z.string().max(40).optional(),
    reasonText: z.string().max(300).optional(),
    etaMinutes: z.number().int().min(1).max(240).optional(),
  })
  .strict();

type Ctx = { params: Promise<{ id: string }> };

export const POST = withStaff(async (req, user, ctx: Ctx) => {
  const orderId = Number((await ctx.params).id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { to, expectedFrom, reasonId, reasonText, etaMinutes } = parsed.data;

  if (!isOrderStatus(to)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  // Build the stored reason from the short list, with free text appended when
  // staff picked "other" or added detail.
  const picked = REJECTION_REASONS.find((r) => r.id === reasonId);
  const free = sanitizeText(reasonText, 300);
  const reason =
    picked && free
      ? `${picked.el} — ${free}`
      : picked
        ? picked.el
        : free || null;

  const result = await transitionOrder({
    orderId,
    to,
    changedBy: user.email,
    reason,
    etaMinutes: etaMinutes ?? null,
    expectedFrom: expectedFrom && isOrderStatus(expectedFrom) ? expectedFrom : undefined,
  });

  if (!result.ok) {
    const status =
      result.error === "not_found"
        ? 404
        : result.error === "internal_error"
          ? 500
          : result.error === "reason_required"
            ? 400
            : 409;
    return NextResponse.json(
      { error: result.error, currentStatus: result.currentStatus },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    from: result.from,
    to: result.to,
    orderCode: result.orderCode,
  });
});
