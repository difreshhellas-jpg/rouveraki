import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  PaymentSnapshot,
  RefundResult,
  VerifiedPaymentEvent,
} from "./types";
import { buildFiscalisationData, assertFiscalTotalsBalance } from "./fiscalisation";
import {
  createPaymentOrder,
  getTransaction,
  isCaptured,
  refundTransaction,
} from "../viva";

/**
 * Live Viva provider. Same interface as the mock, so nothing above this file
 * changes when PAYMENT_MODE flips.
 */

/** Viva event type ids. */
const EVENT = {
  PAYMENT_CREATED: 1796,
  REFUND_CREATED: 1797,
  TRANSACTION_FAILED: 1798,
} as const;

export class VivaPaymentProvider implements PaymentProvider {
  readonly name = "viva" as const;

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const fiscal = buildFiscalisationData(input.lines, input.deliveryFeeCents);
    // Refuse to submit a receipt whose lines do not add up to the charge.
    assertFiscalTotalsBalance(fiscal, input.amountCents);

    const result = await createPaymentOrder({
      amountCents: input.amountCents,
      description: `Ρουβεράκι ${input.orderCode}`,
      merchantReference: input.orderCode,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail,
      preferredMethod: input.method,
      fiscalisationData: fiscal,
    });

    return {
      reference: result.orderCode,
      redirectUrl: result.redirectUrl,
      settledImmediately: false,
    };
  }

  async getPayment(transactionId: string): Promise<PaymentSnapshot | null> {
    const t = await getTransaction(transactionId);
    if (!t) return null;
    return {
      transactionId: t.transactionId,
      reference: t.orderCode,
      status: isCaptured(t) ? "captured" : "failed",
      // Viva reports the transaction amount in euros here, not cents.
      amountCents: Math.round(t.amount * 100),
      merchantReference: t.merchantTrns ?? null,
    };
  }

  async refundPayment(
    transactionId: string,
    amountCents: number,
  ): Promise<RefundResult> {
    return refundTransaction(transactionId, amountCents);
  }

  /* ======================================================================
   *  WEBHOOK VERIFICATION — the highest-stakes code in the project.
   *
   *  Two independent checks, both of which must pass:
   *
   *  1. SIGNATURE. If VIVA_WEBHOOK_SECRET is configured, the raw body is
   *     HMAC-SHA256'd and compared against the signature header in constant
   *     time. A forged body fails here.
   *
   *  2. SOURCE OF TRUTH. Regardless of the signature, the transaction is read
   *     back from Viva's API with our own OAuth credentials, and the captured
   *     amount and merchant reference come from THAT response, never from the
   *     request body. An attacker who somehow produced a valid signature still
   *     cannot invent a transaction that Viva does not have.
   *
   *  Check 2 is what actually protects the money. Check 1 exists so that
   *  garbage is rejected before we spend an API call on it, and so that a
   *  future Viva change to signed webhooks is already handled.
   * ==================================================================== */
  async verifyWebhook(
    req: Request,
    rawBody: string,
  ): Promise<VerifiedPaymentEvent | null> {
    const secret = process.env.VIVA_WEBHOOK_SECRET;

    if (secret) {
      const provided =
        req.headers.get("viva-signature") ??
        req.headers.get("x-viva-signature") ??
        req.headers.get("x-signature") ??
        "";

      if (!(await verifyHmac(rawBody, provided, secret))) {
        console.warn("[viva] webhook rejected: signature mismatch");
        return null;
      }
    } else {
      // Not fatal, because check 2 below is the real defence — but it is a
      // configuration gap and should be loud.
      console.warn(
        "[viva] VIVA_WEBHOOK_SECRET is not set; relying solely on transaction re-verification",
      );
    }

    let body: VivaWebhookBody;
    try {
      body = JSON.parse(rawBody) as VivaWebhookBody;
    } catch {
      return null;
    }

    const transactionId = body.EventData?.TransactionId;
    if (!transactionId) return null;

    // --- the check that counts: ask Viva, do not believe the caller ---------
    const snapshot = await this.getPayment(transactionId);
    if (!snapshot) {
      console.warn(`[viva] webhook names a transaction Viva does not have: ${transactionId}`);
      return null;
    }
    if (!snapshot.merchantReference) {
      console.warn(`[viva] transaction ${transactionId} carries no merchant reference`);
      return null;
    }

    const eventId = body.MessageId
      ? `viva:${body.MessageId}`
      : `viva:${body.EventTypeId ?? "unknown"}:${transactionId}`;

    const kind =
      body.EventTypeId === EVENT.REFUND_CREATED
        ? "refund_created"
        : snapshot.status === "captured"
          ? "payment_captured"
          : "payment_failed";

    return {
      kind,
      transactionId: snapshot.transactionId,
      merchantReference: snapshot.merchantReference.trim().toUpperCase(),
      // From the verified snapshot, never from the request body.
      amountCents: snapshot.amountCents,
      eventId,
      raw: body,
    };
  }

  webhookActivationKey(): string | null {
    return process.env.VIVA_WEBHOOK_VERIFICATION_KEY ?? null;
  }
}

type VivaWebhookBody = {
  EventTypeId?: number;
  MessageId?: string;
  EventData?: { TransactionId?: string };
};

/**
 * HMAC-SHA256 over the raw body, compared in constant time.
 *
 * Exported so the verification suite can exercise it directly. It is the
 * single highest-stakes function in the project and deserves its own tests
 * rather than only being reachable through a live webhook.
 *
 * Uses Web Crypto rather than node:crypto so this module carries no `node:`
 * scheme import. That keeps the payments tree resolvable in every bundling
 * layer, and means the webhook could run on the Edge runtime unchanged.
 *
 * Accepts hex or base64, with or without a `sha256=` prefix, because signature
 * header formats vary between providers and provider versions.
 */
export async function verifyHmac(
  rawBody: string,
  provided: string,
  secret: string,
): Promise<boolean> {
  if (!provided) return false;
  const candidate = provided.replace(/^sha256=/i, "").trim();

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)),
  );

  const hex = Array.from(signature)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const base64 = btoa(String.fromCharCode(...signature));

  return (
    constantTimeEquals(candidate.toLowerCase(), hex) ||
    constantTimeEquals(candidate, base64)
  );
}

/**
 * Length-independent comparison. The length of a signature is not a secret,
 * so returning early on a length mismatch leaks nothing.
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
