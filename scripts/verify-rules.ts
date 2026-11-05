/**
 * Business-rule checks that need no database.
 *
 * These cover the parts where a quiet mistake is expensive and invisible: the
 * order state machine, the two opening-hour windows that wrap past midnight,
 * phone normalisation, note sanitisation and the money maths.
 *
 * Run with:  npm run verify
 */
import assert from "node:assert/strict";

import {
  canTransition,
  nextStatuses,
  requiresReason,
  triggersRefund,
  isTerminal,
  trackingSteps,
  initialStatus,
  ORDER_STATUSES,
  type OrderStatus,
} from "../src/lib/order-status";
import { generateOrderCode, isOrderCodeShape } from "../src/lib/order-code";
import { sanitizeText, normalizeGreekPhone } from "../src/lib/sanitize";
import { toCents, toDecimal, formatEuro } from "../src/lib/money";
import { CATEGORIES, AGE_GATED_CATEGORIES, DELIVERY_ZONES } from "../src/lib/brand";
import { cartTotals, type CartLine } from "../src/store/cart";
import {
  splitVat,
  buildFiscalisationData,
  assertFiscalTotalsBalance,
  vatCategoryForCategory,
  vatRateForCategory,
  VAT_CATEGORY,
} from "../src/lib/payments/fiscalisation";
import { verifyHmac } from "../src/lib/payments/viva-provider";

let checks = 0;
const check = (label: string, fn: () => void) => {
  fn();
  checks++;
  console.log(`  ok  ${label}`);
};

const asyncCheck = async (label: string, fn: () => Promise<void>) => {
  await fn();
  checks++;
  console.log(`  ok  ${label}`);
};

console.log("\n-- order state machine --------------------------------------");

check("happy path, delivery", () => {
  const path: OrderStatus[] = [
    "PENDING_PAYMENT",
    "PAID_AWAITING_ACCEPTANCE",
    "ACCEPTED",
    "DELIVERED",
  ];
  for (let i = 0; i < path.length - 1; i++) {
    assert.ok(
      canTransition(path[i], path[i + 1]),
      `${path[i]} -> ${path[i + 1]} should be legal`,
    );
  }
});

check("only accept and delivered: no steps in between", () => {
  assert.ok(!canTransition("ACCEPTED", "PREPARING"));
  assert.ok(!canTransition("ACCEPTED", "READY"));
  assert.ok(!canTransition("ACCEPTED", "DISPATCHED"));
  assert.ok(!canTransition("ACCEPTED", "COMPLETED"));
  assert.ok(isTerminal("DELIVERED"));
});

check("cannot skip acceptance", () => {
  assert.ok(!canTransition("PAID_AWAITING_ACCEPTANCE", "PREPARING"));
  assert.ok(!canTransition("PENDING_PAYMENT", "ACCEPTED"));
});

check("cannot walk backwards", () => {
  assert.ok(!canTransition("DELIVERED", "ACCEPTED"));
  assert.ok(!canTransition("ACCEPTED", "PAID_AWAITING_ACCEPTANCE"));
});

check("customer cancel only before acceptance", () => {
  assert.ok(canTransition("PAID_AWAITING_ACCEPTANCE", "CANCELLED_BY_CUSTOMER"));
  assert.ok(!canTransition("ACCEPTED", "CANCELLED_BY_CUSTOMER"));
  assert.ok(!canTransition("DELIVERED", "CANCELLED_BY_CUSTOMER"));
});

check("restaurant cancel only after acceptance", () => {
  assert.ok(canTransition("ACCEPTED", "CANCELLED_BY_RESTAURANT"));
  assert.ok(!canTransition("PAID_AWAITING_ACCEPTANCE", "CANCELLED_BY_RESTAURANT"));
  assert.ok(!canTransition("DELIVERED", "CANCELLED_BY_RESTAURANT"));
});

check("every terminal state is really terminal", () => {
  for (const s of ["DELIVERED", "COMPLETED", "REJECTED", "CANCELLED_BY_CUSTOMER", "CANCELLED_BY_RESTAURANT", "PAYMENT_FAILED"] as OrderStatus[]) {
    assert.equal(nextStatuses(s).length, 0, `${s} should have no successors`);
  }
});

check("reason is required exactly where money is at stake by choice", () => {
  assert.ok(requiresReason("REJECTED"));
  assert.ok(requiresReason("CANCELLED_BY_RESTAURANT"));
  assert.ok(!requiresReason("ACCEPTED"));
});

check("every cancellation triggers a refund", () => {
  assert.ok(triggersRefund("REJECTED"));
  assert.ok(triggersRefund("CANCELLED_BY_CUSTOMER"));
  assert.ok(triggersRefund("CANCELLED_BY_RESTAURANT"));
  assert.ok(!triggersRefund("DELIVERED"));
});

check("no status is unreachable from the start", () => {
  const seen = new Set<OrderStatus>(["PENDING_PAYMENT"]);
  const queue: OrderStatus[] = ["PENDING_PAYMENT"];
  while (queue.length) {
    for (const next of nextStatuses(queue.pop()!)) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  const legacy = new Set<OrderStatus>(["PREPARING", "READY", "DISPATCHED", "COMPLETED"]);
  const unreachable = ORDER_STATUSES.filter((s) => !seen.has(s) && !legacy.has(s));
  assert.deepEqual(unreachable, [], `unreachable: ${unreachable.join(", ")}`);
});

check("tracking steps match the fulfillment type", () => {
  for (const f of ["delivery", "pickup"] as const) {
    assert.deepEqual(trackingSteps(f), ["PAID_AWAITING_ACCEPTANCE", "ACCEPTED", "DELIVERED"]);
  }
});

check("cash orders skip the payment state", () => {
  assert.equal(initialStatus("cash"), "PAID_AWAITING_ACCEPTANCE");
  assert.equal(initialStatus("card"), "PENDING_PAYMENT");
  assert.equal(initialStatus("iris"), "PENDING_PAYMENT");
});

console.log("\n-- opening hours (both windows wrap midnight) ----------------");

// The hours module reads the real clock, so exercise the wrap logic directly
// against a fixed set of Athens wall-clock times.
const within = (minutes: number, opens: string, closes: string) => {
  const m = (s: string) => {
    const [h, mm] = s.split(":").map(Number);
    return h * 60 + mm;
  };
  const o = m(opens);
  const c = closes === "00:00" ? 1440 : m(closes);
  return o < c ? minutes >= o && minutes < c : minutes >= o || minutes < c;
};

check("shop 06:00-01:00 is open at 00:30 and closed at 03:00", () => {
  assert.equal(within(30, "06:00", "01:00"), true, "00:30 should be open");
  assert.equal(within(180, "06:00", "01:00"), false, "03:00 should be closed");
  assert.equal(within(6 * 60, "06:00", "01:00"), true, "06:00 should be open");
  assert.equal(within(5 * 60 + 59, "06:00", "01:00"), false, "05:59 closed");
  assert.equal(within(23 * 60, "06:00", "01:00"), true, "23:00 open");
});

check("delivery 08:00-00:00 closes at midnight, not opens", () => {
  assert.equal(within(23 * 60 + 59, "08:00", "00:00"), true, "23:59 delivering");
  assert.equal(within(0, "08:00", "00:00"), false, "00:00 not delivering");
  assert.equal(within(30, "08:00", "00:00"), false, "00:30 not delivering");
  assert.equal(within(7 * 60 + 59, "08:00", "00:00"), false, "07:59 not delivering");
  assert.equal(within(8 * 60, "08:00", "00:00"), true, "08:00 delivering");
});

check("the late-night gap is real: shop open, delivery closed at 00:30", () => {
  assert.equal(within(30, "06:00", "01:00"), true);
  assert.equal(within(30, "08:00", "00:00"), false);
});

console.log("\n-- order codes ----------------------------------------------");

check("codes avoid ambiguous glyphs and pass their own shape check", () => {
  for (let i = 0; i < 2000; i++) {
    const code = generateOrderCode();
    assert.equal(code.length, 6);
    assert.ok(isOrderCodeShape(code), `bad code ${code}`);
    assert.ok(!/[01OIL]/.test(code), `ambiguous glyph in ${code}`);
  }
});

check("codes are not sequential", () => {
  const a = new Set(Array.from({ length: 500 }, () => generateOrderCode()));
  assert.ok(a.size > 480, `too many collisions in 500 draws: ${a.size} unique`);
});

check("shape check rejects junk", () => {
  for (const bad of ["", "abc", "AAAA0A", "AAAAAAAAAAA", "../../etc", "AB CDE"]) {
    assert.ok(!isOrderCodeShape(bad), `should reject ${JSON.stringify(bad)}`);
  }
});

console.log("\n-- input sanitising -----------------------------------------");

check("control characters and angle brackets are stripped", () => {
  assert.equal(sanitizeText(`no${String.fromCharCode(0)} onion`), "no onion");
  assert.equal(sanitizeText("<script>alert(1)</script>"), "scriptalert(1)/script");
  assert.equal(sanitizeText("a\r\nb"), "a b");
});

check("bidi overrides cannot spoof a kitchen ticket", () => {
  assert.equal(sanitizeText("no‮onion"), "noonion");
  assert.equal(sanitizeText("x​y"), "xy");
});

check("notes are hard-capped", () => {
  assert.equal(sanitizeText("a".repeat(5000), 200).length, 200);
});

check("Greek phone numbers normalise to +30", () => {
  for (const input of ["6971234567", "+30 697 123 4567", "0030 6971234567", "30 6971234567"]) {
    assert.equal(normalizeGreekPhone(input), "+306971234567", `failed on ${input}`);
  }
  assert.equal(normalizeGreekPhone("2743026683"), "+302743026683");
});

check("implausible phone numbers are rejected", () => {
  for (const bad of ["123", "", "abcdefghij", "0000000000", "+1 555 0100"]) {
    assert.equal(normalizeGreekPhone(bad), null, `should reject ${bad}`);
  }
});

console.log("\n-- money ----------------------------------------------------");

check("float cents never drift", () => {
  assert.equal(toCents("4.10") + toCents("0.20"), 430);
  assert.equal(toCents(3.9) * 3, 1170);
  // Decimal drops a trailing zero in toString() ("11.7"); the column is still
  // DECIMAL(n,2), so compare the value, not its rendering.
  assert.equal(Number(toDecimal(1170)), 11.7);
  assert.equal(toDecimal(1170).toFixed(2), "11.70");
});

check("prices fit DECIMAL(5,2)", () => {
  assert.equal(toDecimal(99_999).toFixed(2), "999.99");
  assert.equal(Number(toDecimal(99_999)), 999.99);
});

check("euros format in the Greek convention", () => {
  const s = formatEuro(4.5, "el-GR");
  assert.ok(s.includes("4,50"), `expected a comma decimal, got ${s}`);
});

console.log("\n-- cart / zones ---------------------------------------------");

const line = (over: Partial<CartLine> = {}): CartLine => ({
  lineId: "1::",
  menuItemId: 1,
  name: "Πίτα γύρο",
  unitPriceCents: 390,
  quantity: 1,
  itemNotes: "",
  requiresAgeVerification: false,
  category: "pites",
  ...over,
});

check("pickup has no fee and no minimum", () => {
  const t = cartTotals([line()], "pickup", "xylokastro-kentro");
  assert.equal(t.deliveryFeeCents, 0);
  assert.equal(t.minimumCents, 0);
  assert.equal(t.meetsMinimum, true);
});

check("zone minimum is enforced on the subtotal, not the total", () => {
  const zone = DELIVERY_ZONES.find((z) => z.id === "sykia-pefkias")!;
  const t = cartTotals([line({ quantity: 2 })], "delivery", zone.id);
  assert.equal(t.subtotalCents, 780);
  assert.equal(t.minimumCents, zone.minimumOrder * 100);
  assert.equal(t.meetsMinimum, false);
  assert.equal(t.shortfallCents, zone.minimumOrder * 100 - 780);
  // The fee must not be counted towards clearing the minimum.
  assert.ok(t.totalCents > t.subtotalCents);
});

check("delivery fee is added on top of the subtotal", () => {
  const t = cartTotals([line({ quantity: 4 })], "delivery", "sykia-pefkias");
  assert.equal(t.subtotalCents, 1560);
  assert.equal(t.deliveryFeeCents, 250);
  assert.equal(t.totalCents, 1810);
  assert.equal(t.meetsMinimum, true);
});

console.log("\n-- catalogue integrity --------------------------------------");

check("category slugs are unique", () => {
  const slugs = CATEGORIES.map((c) => c.slug);
  assert.equal(new Set(slugs).size, slugs.length);
});

check("every printed-menu category is present", () => {
  assert.equal(CATEGORIES.length, 16);
  for (const expected of ["pites", "kalamakia", "merides", "poikilies", "burger", "santouits", "orektika", "salates", "zymarika", "psari", "kafedes", "rofimata", "chymoi", "anapsyktika", "mpyres", "pota"]) {
    assert.ok(CATEGORIES.some((c) => c.slug === expected), `missing ${expected}`);
  }
});

check("every category belongs to a daypart card", () => {
  for (const c of CATEGORIES) {
    assert.ok(["morning", "grill", "evening"].includes(c.daypart), `${c.slug} has no daypart`);
  }
});

check("age gating is off by the owner's choice; any gated slug must exist", () => {
  assert.deepEqual([...AGE_GATED_CATEGORIES], []);
  for (const c of AGE_GATED_CATEGORIES) assert.ok(CATEGORIES.some((k) => k.slug === c), c);
});

check("delivery zone ids are unique and fees are sane", () => {
  const ids = DELIVERY_ZONES.map((z) => z.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const z of DELIVERY_ZONES) {
    assert.ok(z.minimumOrder >= 0 && z.minimumOrder < 100);
    assert.ok(z.deliveryFee >= 0 && z.deliveryFee < 20);
    assert.ok(z.etaMinutes > 0 && z.etaMinutes < 180);
  }
});

console.log("\n-- fiscal / VAT ---------------------------------------------");

check("alcohol is 24% and food service is 13%", () => {
  assert.equal(vatCategoryForCategory("pota"), VAT_CATEGORY.RATE_24);
  assert.equal(vatRateForCategory("pota"), 0.24);
  assert.equal(vatRateForCategory("mpyres"), 0.24);
  for (const c of ["pites", "merides", "burger", "psari", "kafedes", "salates", "zymarika"]) {
    assert.equal(vatCategoryForCategory(c), VAT_CATEGORY.RATE_13, c);
    assert.equal(vatRateForCategory(c), 0.13, c);
  }
});

check("an unknown category falls back to the food rate, not zero", () => {
  assert.equal(vatCategoryForCategory("something-new"), VAT_CATEGORY.RATE_13);
});

check("net plus VAT always equals the gross exactly", () => {
  // Every cent value up to 50 euro across all three bands: no rounding drift.
  for (const rate of [0.24, 0.13, 0.06]) {
    for (let gross = 1; gross <= 5000; gross++) {
      const { netCents, vatCents } = splitVat(gross, rate);
      assert.equal(netCents + vatCents, gross, `${gross} at ${rate}`);
    }
  }
});

check("a mixed food and alcohol receipt balances to the cent", () => {
  const lines = [
    { name: "Πίτα γύρο", quantity: 2, unitPriceCents: 390, totalCents: 780,
      vatRate: 0.13, vatCategoryCode: VAT_CATEGORY.RATE_13 },
    { name: "Ούζο", quantity: 3, unitPriceCents: 400, totalCents: 1200,
      vatRate: 0.24, vatCategoryCode: VAT_CATEGORY.RATE_24 },
    { name: "Ελληνικός καφές", quantity: 1, unitPriceCents: 180, totalCents: 180,
      vatRate: 0.13, vatCategoryCode: VAT_CATEGORY.RATE_13 },
  ];
  const fee = 250;
  const data = buildFiscalisationData(lines, fee);
  const expected = 780 + 1200 + 180 + fee;

  assert.doesNotThrow(() => assertFiscalTotalsBalance(data, expected));
  assert.equal(Math.round(data.totalAmount * 100), expected);
  assert.equal(
    Math.round((data.netAmount + data.vatAmount) * 100),
    expected,
    "net + vat must equal the total",
  );
  // The delivery fee gets its own line.
  assert.equal(data.lineItems.length, 4);
  // Both VAT bands present, so this is not silently charging one rate.
  const bands = new Set(data.lineItems.map((li) => li.vatCategory));
  assert.ok(bands.has(VAT_CATEGORY.RATE_24) && bands.has(VAT_CATEGORY.RATE_13));
});

check("a receipt that does not balance is rejected", () => {
  const data = buildFiscalisationData(
    [{ name: "x", quantity: 1, unitPriceCents: 100, totalCents: 100,
       vatRate: 0.13, vatCategoryCode: VAT_CATEGORY.RATE_13 }],
    0,
  );
  assert.throws(() => assertFiscalTotalsBalance(data, 999));
});

check("no delivery line when there is no delivery fee", () => {
  const data = buildFiscalisationData(
    [{ name: "x", quantity: 1, unitPriceCents: 500, totalCents: 500,
       vatRate: 0.13, vatCategoryCode: VAT_CATEGORY.RATE_13 }],
    0,
  );
  assert.equal(data.lineItems.length, 1);
});

/* ---------------------------------------------------------------------------
 * Webhook signature verification.
 *
 * This is the single highest-stakes function in the project: it is what stops
 * a forged "payment confirmed" request from releasing an order. Tested
 * directly rather than only through a live webhook.
 * ------------------------------------------------------------------------ */
const SECRET = "test-webhook-secret";
const BODY = JSON.stringify({
  EventTypeId: 1796,
  EventData: { TransactionId: "abc" },
});

/** Produces the signature a legitimate sender would send. */
async function sign(body: string, secret: string, encoding: "hex" | "base64") {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)),
  );
  return encoding === "hex"
    ? Array.from(sig).map((b) => b.toString(16).padStart(2, "0")).join("")
    : Buffer.from(sig).toString("base64");
}

async function webhookChecks() {
  console.log("\n-- webhook signature verification ---------------------------");

  const hex = await sign(BODY, SECRET, "hex");
  const b64 = await sign(BODY, SECRET, "base64");

  await asyncCheck("a correct hex signature is accepted", async () => {
    assert.equal(await verifyHmac(BODY, hex, SECRET), true);
  });

  await asyncCheck("a correct base64 signature is accepted", async () => {
    assert.equal(await verifyHmac(BODY, b64, SECRET), true);
  });

  await asyncCheck("the sha256= prefix is tolerated", async () => {
    assert.equal(await verifyHmac(BODY, `sha256=${hex}`, SECRET), true);
  });

  await asyncCheck("a tampered body is rejected", async () => {
    const forged = JSON.stringify({
      EventTypeId: 1796,
      EventData: { TransactionId: "attacker-controlled" },
    });
    assert.equal(await verifyHmac(forged, hex, SECRET), false);
  });

  await asyncCheck("the wrong secret is rejected", async () => {
    assert.equal(await verifyHmac(BODY, hex, "not-the-secret"), false);
  });

  await asyncCheck("an empty or junk signature is rejected", async () => {
    for (const bad of ["", "deadbeef", "sha256=", "0".repeat(64)]) {
      assert.equal(await verifyHmac(BODY, bad, SECRET), false, bad);
    }
  });

  await asyncCheck("a single flipped character is rejected", async () => {
    const flipped = hex.slice(0, -1) + (hex.at(-1) === "a" ? "b" : "a");
    assert.equal(await verifyHmac(BODY, flipped, SECRET), false);
  });

  console.log(`\nAll ${checks} checks passed.\n`);
}

webhookChecks().catch((e) => {
  console.error(e);
  process.exit(1);
});
