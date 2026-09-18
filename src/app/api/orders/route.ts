import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateOrderCode } from "@/lib/order-code";
import { sanitizeText, normalizeGreekPhone } from "@/lib/sanitize";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { zoneById, DEFAULT_ETA_MINUTES } from "@/lib/brand";
import { isShopOpen, isDeliveryOpen, isAlcoholSaleAllowed } from "@/lib/hours";
import { initialStatus } from "@/lib/order-status";
import { toDecimal } from "@/lib/money";
import { payments, PAYMENT_MODE, vatCategoryForCategory, vatRateForCategory } from "@/lib/payments";
import { publishStaffEvent } from "@/lib/realtime";
import { sendOrderStatusSms } from "@/lib/sms";
import { transitionOrder } from "@/lib/order-service";

export const dynamic = "force-dynamic";

/* ---- request shape ------------------------------------------------------ */

const LineSchema = z.object({
  menuItemId: z.number().int().positive(),
  quantity: z.number().int().min(1).max(30),
  itemNotes: z.string().max(200).optional().default(""),
});

const OrderSchema = z
  .object({
    lines: z.array(LineSchema).min(1).max(60),
    fulfillmentType: z.enum(["delivery", "pickup"]),
    customerName: z.string().min(1).max(120),
    customerPhone: z.string().min(6).max(30),
    customerAddress: z.string().max(300).optional().nullable(),
    deliveryZone: z.string().max(64).optional().nullable(),
    generalNotes: z.string().max(400).optional().nullable(),
    paymentMethod: z.enum(["iris", "card", "cash"]),
    ageVerified: z.boolean().optional().default(false),
    marketingOptIn: z.boolean().optional().default(false),
  })
  .strict();

const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error, ...extra }, { status });

/* ---- handler ------------------------------------------------------------ */

export async function POST(req: Request) {
  // Two independent limits: one on the network origin, one on the phone number,
  // so neither a single IP nor a single number can flood the kitchen.
  const ip = clientIp(req);
  const byIp = rateLimit(`order:ip:${ip}`, 8, 10 * 60_000);
  if (!byIp.ok) {
    return bad("rate_limited", 429, { retryAfter: byIp.retryAfterSeconds });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad("invalid_json");
  }

  const parsed = OrderSchema.safeParse(body);
  if (!parsed.success) {
    return bad("invalid_payload", 400, { issues: parsed.error.flatten() });
  }
  const input = parsed.data;

  const phone = normalizeGreekPhone(input.customerPhone);
  if (!phone) return bad("invalid_phone");

  const byPhone = rateLimit(`order:phone:${phone}`, 5, 10 * 60_000);
  if (!byPhone.ok) {
    return bad("rate_limited", 429, { retryAfter: byPhone.retryAfterSeconds });
  }

  /* ---- opening hours --------------------------------------------------- */
  if (!isShopOpen()) return bad("shop_closed", 409);
  if (input.fulfillmentType === "delivery" && !isDeliveryOpen()) {
    return bad("delivery_closed", 409);
  }

  /* ---- delivery details ------------------------------------------------ */
  const address =
    input.fulfillmentType === "delivery"
      ? sanitizeText(input.customerAddress, 300)
      : null;
  if (input.fulfillmentType === "delivery" && !address) {
    return bad("address_required");
  }

  const zone =
    input.fulfillmentType === "delivery"
      ? zoneById(String(input.deliveryZone ?? ""))
      : undefined;
  if (input.fulfillmentType === "delivery" && !zone) return bad("invalid_zone");

  /* ---- re-price from the database -------------------------------------
     The client sends ids and quantities only. Prices, availability and the
     age-gate flag are read here; a tampered cart cannot change what is charged
     or sneak a bottle of ouzo past the 18+ check.                            */
  const ids = [...new Set(input.lines.map((l) => l.menuItemId))];
  const menuItems = await prisma.menuItem.findMany({ where: { id: { in: ids } } });
  const byId = new Map(menuItems.map((m) => [m.id, m]));

  if (menuItems.length !== ids.length) return bad("unknown_menu_item");

  const unavailable = menuItems.filter((m) => !m.available);
  if (unavailable.length) {
    return bad("item_unavailable", 409, {
      items: unavailable.map((m) => ({ id: m.id, name: m.name })),
    });
  }

  let subtotalCents = 0;
  let maxPrepMinutes = 0;
  let cartHasAgeGated = false;

  const storedItems = input.lines.map((line) => {
    const item = byId.get(line.menuItemId)!;
    const unitPriceCents = Math.round(Number(item.price) * 100);
    subtotalCents += unitPriceCents * line.quantity;
    maxPrepMinutes = Math.max(maxPrepMinutes, item.prepTimeMinutes);
    if (item.requiresAgeVerification) cartHasAgeGated = true;

    return {
      menu_item_id: item.id,
      name: item.name,
      name_en: item.nameEn,
      unit_price_cents: unitPriceCents,
      quantity: line.quantity,
      // Sanitised here, because this string is printed on the kitchen ticket
      // and interpolated into SMS bodies downstream.
      item_notes: sanitizeText(line.itemNotes, 200),
      category: item.category,
    };
  });

  /* ---- alcohol rules --------------------------------------------------- */
  if (cartHasAgeGated) {
    if (!input.ageVerified) return bad("age_verification_required");
    if (!isAlcoholSaleAllowed()) return bad("alcohol_hours_blocked", 409);
  }

  /* ---- totals ----------------------------------------------------------- */
  const deliveryFeeCents = zone ? Math.round(zone.deliveryFee * 100) : 0;
  const minimumCents = zone ? Math.round(zone.minimumOrder * 100) : 0;
  if (subtotalCents < minimumCents) {
    return bad("below_minimum", 409, {
      minimumCents,
      shortfallCents: minimumCents - subtotalCents,
    });
  }
  const totalCents = subtotalCents + deliveryFeeCents;

  /* ---- customer --------------------------------------------------------- */
  const customerName = sanitizeText(input.customerName, 120);
  if (!customerName) return bad("invalid_name");

  const customer = await prisma.customer.upsert({
    where: { phone },
    create: { phone, name: customerName, marketingOptIn: input.marketingOptIn },
    // Never downgrade an existing opt-in to false from a checkout where the box
    // simply was not ticked; withdrawal happens through the unsubscribe path.
    update: {
      name: customerName,
      ...(input.marketingOptIn ? { marketingOptIn: true } : {}),
    },
  });

  /* ---- create ----------------------------------------------------------- */
  const status = initialStatus(input.paymentMethod);
  const etaMinutes =
    DEFAULT_ETA_MINUTES[input.fulfillmentType] + Math.max(0, maxPrepMinutes - 10);

  let order: { id: number; orderCode: string } | null = null;

  // Retry on the (astronomically unlikely) order-code collision rather than
  // handing the customer a 500.
  for (let attempt = 0; attempt < 5 && !order; attempt++) {
    const orderCode = generateOrderCode();
    try {
      const created = await prisma.$transaction(async (tx) => {
        const row = await tx.order.create({
          data: {
            orderCode,
            customerId: customer.id,
            customerName,
            customerPhone: phone,
            customerAddress: address,
            deliveryZone: zone?.id ?? null,
            fulfillmentType: input.fulfillmentType,
            items: storedItems as unknown as Prisma.InputJsonValue,
            generalNotes: sanitizeText(input.generalNotes, 400) || null,
            subtotalAmount: toDecimal(subtotalCents),
            deliveryFee: toDecimal(deliveryFeeCents),
            totalAmount: toDecimal(totalCents),
            status,
            paymentMethod: input.paymentMethod,
            ageVerified: cartHasAgeGated ? true : false,
            etaMinutes,
          },
          select: { id: true, orderCode: true },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: row.id,
            fromStatus: null,
            toStatus: status,
            changedBy: "customer",
            reason: null,
          },
        });

        return row;
      });
      order = created;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        continue; // order_code collision — try another code
      }
      console.error("[orders] create failed", e);
      return bad("internal_error", 500);
    }
  }

  if (!order) return bad("internal_error", 500);

  /* ---- cash: straight into the queue ------------------------------------ */
  if (input.paymentMethod === "cash") {
    void publishStaffEvent({
      type: "new_order",
      orderId: order.id,
      orderCode: order.orderCode,
      status,
      totalAmount: (totalCents / 100).toFixed(2),
      fulfillmentType: input.fulfillmentType,
      createdAt: new Date().toISOString(),
    });
    void sendOrderStatusSms("PAID_AWAITING_ACCEPTANCE", {
      orderCode: order.orderCode,
      phone,
      fulfillmentType: input.fulfillmentType,
    });

    return NextResponse.json({
      orderCode: order.orderCode,
      status,
      redirectUrl: null,
      trackingUrl: `/order/${order.orderCode}`,
    });
  }

  /* ---- card / IRIS: one call, either provider --------------------------
     payments() returns the mock provider or the live Viva provider depending
     on PAYMENT_MODE. There is no branch here on purpose: the only difference
     is that the mock settles immediately, which the result reports.        */
  const fiscalLines = input.lines.map((line) => {
    const item = byId.get(line.menuItemId)!;
    const unit = Math.round(Number(item.price) * 100);
    return {
      name: item.name,
      quantity: line.quantity,
      unitPriceCents: unit,
      totalCents: unit * line.quantity,
      vatRate: vatRateForCategory(item.category),
      vatCategoryCode: vatCategoryForCategory(item.category),
    };
  });

  try {
    const result = await payments().createPayment({
      orderId: order.id,
      orderCode: order.orderCode,
      amountCents: totalCents,
      method: input.paymentMethod,
      customerName,
      customerPhone: phone,
      lines: fiscalLines,
      deliveryFeeCents,
    });

    await prisma.payment.create({
      data: {
        orderId: order.id,
        vivaTransactionId: result.settledImmediately ? result.reference : null,
        vivaOrderCode: result.reference,
        amount: toDecimal(totalCents),
        status: result.settledImmediately ? "captured" : "pending",
        method: input.paymentMethod,
        confirmedAt: result.settledImmediately ? new Date() : null,
      },
    });

    if (result.settledImmediately) {
      // Mock mode: no webhook will ever arrive, so release the order here.
      // In live mode this branch never runs; the verified webhook does it.
      await transitionOrder({
        orderId: order.id,
        to: "PAID_AWAITING_ACCEPTANCE",
        changedBy: "system",
        reason: `Payment settled by ${PAYMENT_MODE} provider`,
        expectedFrom: "PENDING_PAYMENT",
      });

      return NextResponse.json({
        orderCode: order.orderCode,
        status: "PAID_AWAITING_ACCEPTANCE",
        redirectUrl: null,
        trackingUrl: `/order/${order.orderCode}`,
        paymentMode: PAYMENT_MODE,
      });
    }

    return NextResponse.json({
      orderCode: order.orderCode,
      status,
      redirectUrl: result.redirectUrl,
      trackingUrl: `/order/${order.orderCode}`,
      paymentMode: PAYMENT_MODE,
    });
  } catch (e) {
    console.error("[orders] payment creation failed", e);
    await transitionOrder({
      orderId: order.id,
      to: "PAYMENT_FAILED",
      changedBy: "system",
      reason: e instanceof Error ? e.message.slice(0, 200) : "payment error",
      expectedFrom: "PENDING_PAYMENT",
    });
    return bad("payment_failed", 502);
  }
}
