/**
 * End-to-end checks against a running dev server and a real database.
 *
 * These cover the things a client-side check cannot be trusted for: a tampered
 * cart, a bypassed age gate, a guessed order code, and the order state machine
 * under concurrent staff actions.
 *
 *   npm run db:up          (terminal 1)
 *   npm run dev            (terminal 2)
 *   npm run verify:api     (terminal 3)
 *
 * BASE defaults to http://localhost:3000; override with BASE=http://localhost:3111
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });

import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { transitionOrder } from "../src/lib/order-service";

const BASE = process.env.BASE ?? "http://localhost:3000";

/**
 * Several checks below assert that the admin API rejects an unauthenticated
 * caller. DEV_BYPASS deliberately opens exactly those routes, which would turn
 * those assertions into meaningless passes — so refuse to run rather than
 * report a green suite that proves nothing.
 */
if (
  process.env.DEV_BYPASS === "true" ||
  process.env.NEXT_PUBLIC_DEV_BYPASS === "true"
) {
  console.error(
    "DEV_BYPASS is enabled. The admin-auth checks in this suite cannot mean\n" +
      "anything while it is on. Comment it out of .env.local, restart the dev\n" +
      "server, and run this again.",
  );
  process.exit(1);
}

const prisma = new PrismaClient();

let passed = 0;
const check = async (label: string, fn: () => Promise<void>) => {
  await fn();
  passed++;
  console.log(`  ok  ${label}`);
};

/**
 * Each check posts from its own synthetic client IP, so the order rate limiter
 * (8 per IP per 10 minutes) does not fail the suite. The limiter itself is
 * exercised deliberately in its own check below.
 */
let ipCounter = 0;
// The dev server keeps its rate-limit buckets in memory for 10 minutes, so the
// synthetic range is randomised per run — otherwise a second run inside that
// window collides with the first one's buckets.
const IP_BLOCK = Math.floor(Math.random() * 250) + 1;
const nextIp = () => `203.0.${IP_BLOCK}.${(ipCounter++ % 250) + 1}`;

const post = (path: string, body: unknown, ip?: string) =>
  fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip ?? nextIp(),
    },
    body: JSON.stringify(body),
  });

/**
 * A valid baseline order body; individual checks override one field at a time.
 * The phone number is unique per call for the same reason the IP is: the API
 * limits 5 orders per number per 10 minutes.
 */
let phoneCounter = 0;
const orderBody = (over: Record<string, unknown> = {}) => ({
  lines: [{ menuItemId: 0, quantity: 1, itemNotes: "" }],
  fulfillmentType: "pickup",
  customerName: "Δοκιμή Ελέγχου",
  customerPhone: `697${String(IP_BLOCK).padStart(3, "0")}${String(1000 + phoneCounter++).padStart(4, "0")}`,
  paymentMethod: "cash",
  ageVerified: false,
  marketingOptIn: false,
  ...over,
});

async function main() {
  const food = await prisma.menuItem.findFirstOrThrow({
    where: { requiresAgeVerification: false, available: true },
  });
  const booze = await prisma.menuItem.findFirstOrThrow({
    where: { requiresAgeVerification: true, available: true },
  });

  console.log(`\n-- server-side guards (${BASE}) ------------------------------`);

  await check("alcohol without an age declaration is refused", async () => {
    const res = await post(
      "/api/orders",
      orderBody({
        lines: [{ menuItemId: booze.id, quantity: 1, itemNotes: "" }],
        ageVerified: false,
      }),
    );
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, "age_verification_required");
  });

  await check("an unknown menu item is refused", async () => {
    const res = await post(
      "/api/orders",
      orderBody({ lines: [{ menuItemId: 999_999, quantity: 1, itemNotes: "" }] }),
    );
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, "unknown_menu_item");
  });

  await check("an implausible phone number is refused", async () => {
    const res = await post(
      "/api/orders",
      orderBody({
        lines: [{ menuItemId: food.id, quantity: 1, itemNotes: "" }],
        // Long enough to pass the schema's length rule, so this exercises the
        // Greek-number check rather than the generic payload validation.
        customerPhone: "1112223334",
      }),
    );
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, "invalid_phone");
  });

  await check("a delivery order with no address is refused", async () => {
    const res = await post(
      "/api/orders",
      orderBody({
        lines: [{ menuItemId: food.id, quantity: 1, itemNotes: "" }],
        fulfillmentType: "delivery",
        deliveryZone: "xylokastro-kentro",
        customerAddress: "   ",
      }),
    );
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, "address_required");
  });

  await check("an invented delivery zone is refused", async () => {
    const res = await post(
      "/api/orders",
      orderBody({
        lines: [{ menuItemId: food.id, quantity: 1, itemNotes: "" }],
        fulfillmentType: "delivery",
        deliveryZone: "free-delivery-anywhere",
        customerAddress: "Κάπου 1",
      }),
    );
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, "invalid_zone");
  });

  await check("a cart below the zone minimum is refused", async () => {
    const cheap = await prisma.menuItem.findFirstOrThrow({
      where: { requiresAgeVerification: false, available: true },
      orderBy: { price: "asc" },
    });
    const res = await post(
      "/api/orders",
      orderBody({
        lines: [{ menuItemId: cheap.id, quantity: 1, itemNotes: "" }],
        fulfillmentType: "delivery",
        deliveryZone: "sykia-pefkias", // 12 EUR minimum
        customerAddress: "Συκιά 1",
      }),
    );
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error, "below_minimum");
  });

  await check("an unavailable item cannot be ordered", async () => {
    await prisma.menuItem.update({
      where: { id: food.id },
      data: { available: false },
    });
    try {
      const res = await post(
        "/api/orders",
        orderBody({ lines: [{ menuItemId: food.id, quantity: 1, itemNotes: "" }] }),
      );
      assert.equal(res.status, 409);
      assert.equal((await res.json()).error, "item_unavailable");
    } finally {
      await prisma.menuItem.update({
        where: { id: food.id },
        data: { available: true },
      });
    }
  });

  let orderCode = "";
  let orderId = 0;

  await check("a valid order is accepted and priced from the database", async () => {
    const res = await post(
      "/api/orders",
      orderBody({
        lines: [
          // Contains a control character and padding, to prove the server
          // sanitises the note rather than trusting the client to.
          {
            menuItemId: booze.id,
            quantity: 2,
            itemNotes: `  χωρίς${String.fromCharCode(0)} πάγο  `,
          },
        ],
        ageVerified: true,
      }),
    );
    assert.equal(res.status, 200, await res.clone().text());
    const data = (await res.json()) as { orderCode: string };
    orderCode = data.orderCode;

    const row = await prisma.order.findUniqueOrThrow({
      where: { orderCode },
    });
    orderId = row.id;

    const expected = Number(booze.price) * 2;
    assert.equal(Number(row.totalAmount), expected);
    assert.equal(row.ageVerified, true);
    assert.equal(row.status, "PAID_AWAITING_ACCEPTANCE");

    // The note was sanitised (null byte stripped, whitespace collapsed).
    const items = row.items as Array<{ item_notes: string }>;
    assert.equal(items[0].item_notes, "χωρίς πάγο");
  });

  await check("order creation is rate limited per IP", async () => {
    const ip = `198.51.${IP_BLOCK}.77`;
    let limited = false;
    // 8 orders per IP per 10 minutes. Each attempt carries a fresh phone
    // number, so this measures the IP limiter rather than the phone limiter.
    for (let i = 0; i < 10; i++) {
      const res = await post(
        "/api/orders",
        orderBody({ lines: [{ menuItemId: food.id, quantity: 1, itemNotes: "" }] }),
        ip,
      );
      if (res.status === 429) {
        limited = true;
        break;
      }
    }
    assert.ok(limited, "rate limiter never triggered");
  });

  console.log("\n-- order lookup ---------------------------------------------");

  await check("the tracking endpoint returns no personal data", async () => {
    const res = await fetch(`${BASE}/api/orders/${orderCode}`);
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.ok(!body.includes("customerPhone"), "phone leaked");
    assert.ok(!body.includes("customerAddress"), "address leaked");
    assert.ok(body.includes(orderCode));
  });

  await check("a malformed order code 404s without hitting the database", async () => {
    const res = await fetch(`${BASE}/api/orders/AAA0IL`);
    assert.equal(res.status, 404);
  });

  console.log("\n-- admin surface --------------------------------------------");

  await check("admin order list rejects an unauthenticated caller", async () => {
    const res = await fetch(`${BASE}/api/admin/orders`);
    assert.equal(res.status, 401);
  });

  await check("admin transition rejects an unauthenticated caller", async () => {
    const res = await post(`/api/admin/orders/${orderId}/transition`, {
      to: "ACCEPTED",
    });
    assert.equal(res.status, 401);
  });

  await check("admin menu write rejects an unauthenticated caller", async () => {
    const res = await fetch(`${BASE}/api/admin/menu/${food.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceCents: 1 }),
    });
    assert.equal(res.status, 401);
    const still = await prisma.menuItem.findUniqueOrThrow({ where: { id: food.id } });
    assert.equal(Number(still.price), Number(food.price), "price was changed!");
  });

  await check("a forged webhook cannot release an unpaid order", async () => {
    const unpaid = await prisma.order.create({
      data: {
        orderCode: `TSTW${Math.floor(Math.random() * 90 + 10)}`,
        customerName: "Δοκιμή",
        customerPhone: "+306971230001",
        fulfillmentType: "pickup",
        items: [],
        subtotalAmount: "10.00",
        totalAmount: "10.00",
        status: "PENDING_PAYMENT",
        paymentMethod: "card",
      },
    });

    const res = await post("/api/webhooks/viva", {
      EventTypeId: 1796,
      MessageId: `forged-${Date.now()}`,
      EventData: {
        TransactionId: "00000000-dead-beef-0000-000000000000",
        MerchantTrns: unpaid.orderCode,
        Amount: 10,
        StatusId: "F",
      },
    });

    // Viva credentials are absent here, so the handler cannot verify and
    // refuses. With credentials present it would call Viva, find no such
    // transaction, and still refuse. Either way the order must not move.
    assert.ok([200, 503].includes(res.status), `unexpected ${res.status}`);

    const after = await prisma.order.findUniqueOrThrow({
      where: { id: unpaid.id },
    });
    assert.equal(
      after.status,
      "PENDING_PAYMENT",
      "forged webhook released an unpaid order",
    );
    await prisma.order.delete({ where: { id: unpaid.id } });
  });

  console.log("\n-- state machine against the real database ------------------");

  await check("accept sets and confirms the ETA", async () => {
    const r = await transitionOrder({
      orderId,
      to: "ACCEPTED",
      changedBy: "verify@test",
      etaMinutes: 42,
      expectedFrom: "PAID_AWAITING_ACCEPTANCE",
    });
    assert.ok(r.ok, JSON.stringify(r));
    const row = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    assert.equal(row.status, "ACCEPTED");
    assert.equal(row.etaMinutes, 42);
    assert.ok(row.etaConfirmedAt);
  });

  await check("a second accept from a stale screen loses cleanly", async () => {
    const r = await transitionOrder({
      orderId,
      to: "ACCEPTED",
      changedBy: "verify2@test",
      expectedFrom: "PAID_AWAITING_ACCEPTANCE",
    });
    assert.equal(r.ok, false);
    assert.equal((r as { error: string }).error, "stale_state");
  });

  await check("an illegal jump is refused", async () => {
    const r = await transitionOrder({
      orderId,
      to: "DELIVERED",
      changedBy: "verify@test",
    });
    assert.equal(r.ok, false);
    assert.equal((r as { error: string }).error, "illegal_transition");
  });

  await check("rejecting without a reason is refused", async () => {
    const r = await transitionOrder({
      orderId,
      to: "CANCELLED_BY_RESTAURANT",
      changedBy: "verify@test",
      reason: "   ",
    });
    assert.equal(r.ok, false);
    assert.equal((r as { error: string }).error, "reason_required");
  });

  await check("concurrent transitions: exactly one wins", async () => {
    const results = await Promise.all([
      transitionOrder({ orderId, to: "PREPARING", changedBy: "a@test", expectedFrom: "ACCEPTED" }),
      transitionOrder({ orderId, to: "PREPARING", changedBy: "b@test", expectedFrom: "ACCEPTED" }),
      transitionOrder({ orderId, to: "PREPARING", changedBy: "c@test", expectedFrom: "ACCEPTED" }),
    ]);
    const winners = results.filter((r) => r.ok);
    assert.equal(winners.length, 1, `expected 1 winner, got ${winners.length}`);

    const history = await prisma.orderStatusHistory.count({
      where: { orderId, toStatus: "PREPARING" },
    });
    assert.equal(history, 1, "duplicate history rows written");
  });

  await check("the full pickup path completes", async () => {
    for (const to of ["READY", "COMPLETED"] as const) {
      const r = await transitionOrder({ orderId, to, changedBy: "verify@test" });
      assert.ok(r.ok, `${to}: ${JSON.stringify(r)}`);
    }
    const row = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    assert.equal(row.status, "COMPLETED");
  });

  await check("a completed order cannot be moved again", async () => {
    const r = await transitionOrder({
      orderId,
      to: "PREPARING",
      changedBy: "verify@test",
    });
    assert.equal(r.ok, false);
  });

  await check("every transition is recorded in history, in order", async () => {
    const history = await prisma.orderStatusHistory.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" },
    });
    const path = history.map((h) => h.toStatus);
    assert.deepEqual(path, [
      "PAID_AWAITING_ACCEPTANCE",
      "ACCEPTED",
      "PREPARING",
      "READY",
      "COMPLETED",
    ]);
    assert.ok(history.every((h) => h.changedBy));
  });

  console.log(`\nAll ${passed} API checks passed.\n`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
