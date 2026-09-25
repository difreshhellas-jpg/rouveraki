import "server-only";
import { BRAND } from "./brand";
import type { OrderStatus } from "./order-status";
import { siteUrl } from "./site-mode";

/**
 * Order-status SMS (spec §8, step 7).
 *
 * Provider-agnostic on purpose: SMS_PROVIDER picks the transport, and the
 * message bodies below are the only thing that has to stay right. With no
 * provider configured, messages are logged instead of sent, so local and
 * sandbox runs never spend money or text a real customer.
 *
 * Greek text is deliberately sent as-is (UCS-2, 70 chars/segment). Do NOT
 * "helpfully" transliterate to Latin to save segments — it reads as spam.
 */

type Provider = "log" | "twilio" | "yuboto";

const provider = (process.env.SMS_PROVIDER ?? "log") as Provider;

const trackingUrl = (orderCode: string) =>
  `${siteUrl()}/order/${orderCode}`;

/**
 * Which transitions are worth a text. Deliberately not every one: a customer
 * who gets six texts for one souvlaki unsubscribes from everything.
 */
const TEMPLATES: Partial<Record<OrderStatus, (ctx: SmsContext) => string>> = {
  PAID_AWAITING_ACCEPTANCE: (c) =>
    `Ρουβεράκι: Λάβαμε την παραγγελία σου ${c.orderCode}. Θα ενημερωθείς μόλις την επιβεβαιώσουμε. ${trackingUrl(c.orderCode)}`,
  ACCEPTED: (c) =>
    c.etaMinutes
      ? `Ρουβεράκι: Η παραγγελία ${c.orderCode} επιβεβαιώθηκε. Εκτιμώμενος χρόνος ${c.etaMinutes} λεπτά. ${trackingUrl(c.orderCode)}`
      : `Ρουβεράκι: Η παραγγελία ${c.orderCode} επιβεβαιώθηκε. ${trackingUrl(c.orderCode)}`,
  READY: (c) =>
    c.fulfillmentType === "pickup"
      ? `Ρουβεράκι: Η παραγγελία ${c.orderCode} είναι έτοιμη για παραλαβή.`
      : `Ρουβεράκι: Η παραγγελία ${c.orderCode} είναι έτοιμη και φεύγει αμέσως.`,
  DISPATCHED: (c) =>
    `Ρουβεράκι: Η παραγγελία ${c.orderCode} είναι στον δρόμο.`,
  REJECTED: (c) =>
    `Ρουβεράκι: Λυπούμαστε, η παραγγελία ${c.orderCode} δεν μπορεί να εκτελεστεί${c.reason ? ` (${c.reason})` : ""}. Το ποσό επιστρέφεται. Τηλ. ${BRAND.phone.display}`,
  CANCELLED_BY_RESTAURANT: (c) =>
    `Ρουβεράκι: Η παραγγελία ${c.orderCode} ακυρώθηκε${c.reason ? ` (${c.reason})` : ""}. Το ποσό επιστρέφεται. Τηλ. ${BRAND.phone.display}`,
  PAYMENT_FAILED: (c) =>
    `Ρουβεράκι: Η πληρωμή για την παραγγελία ${c.orderCode} δεν ολοκληρώθηκε. Δοκίμασε ξανά: ${trackingUrl(c.orderCode)}`,
};

export type SmsContext = {
  orderCode: string;
  phone: string;
  etaMinutes?: number | null;
  fulfillmentType?: string;
  reason?: string | null;
};

export async function sendOrderStatusSms(
  status: OrderStatus,
  ctx: SmsContext,
): Promise<void> {
  const template = TEMPLATES[status];
  if (!template) return;
  if (!ctx.phone) return;

  const body = template(ctx);

  try {
    await dispatch(ctx.phone, body);
  } catch (e) {
    // An SMS failure must never fail the status transition that triggered it.
    console.error(`[sms] failed to send ${status} for ${ctx.orderCode}`, e);
  }
}

async function dispatch(to: string, body: string): Promise<void> {
  switch (provider) {
    case "twilio":
      return sendViaTwilio(to, body);
    case "yuboto":
      return sendViaYuboto(to, body);
    case "log":
    default:
      console.info(`[sms:log] -> ${to}\n${body}`);
      return;
  }
}

async function sendViaTwilio(to: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) throw new Error("Twilio env vars missing");

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    },
  );
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
}

/** Yuboto Omni — a common Greek choice; alphanumeric sender IDs work locally. */
async function sendViaYuboto(to: string, body: string): Promise<void> {
  const apiKey = process.env.YUBOTO_API_KEY;
  const sender = process.env.YUBOTO_SENDER ?? "Rouveraki";
  if (!apiKey) throw new Error("YUBOTO_API_KEY missing");

  const res = await fetch("https://services.yuboto.com/omni/v1/Send", {
    method: "POST",
    headers: {
      Authorization: `Basic ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phonenumbers: [to.replace(/^\+/, "")],
      channel: "sms",
      sms: { sender, text: body, typesms: "sms", longsms: true },
    }),
  });
  if (!res.ok) throw new Error(`Yuboto ${res.status}: ${await res.text()}`);
}

export const smsProvider = provider;
