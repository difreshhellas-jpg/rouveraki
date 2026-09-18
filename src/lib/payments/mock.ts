import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  PaymentSnapshot,
  RefundResult,
  VerifiedPaymentEvent,
} from "./types";
import { buildFiscalisationData, assertFiscalTotalsBalance } from "./fiscalisation";

/**
 * Mock payment provider — the default, and what runs with no Viva credentials.
 *
 * It does everything the live provider does EXCEPT make a network call:
 *  - builds the same fiscalisationData object and checks it balances, so a VAT
 *    mistake surfaces here rather than on the first real receipt
 *  - returns a fake but well-formed transaction reference
 *  - reports settledImmediately, so checkout routes straight to tracking
 *
 * It deliberately does NOT fake a webhook round trip. The order route treats an
 * immediate settlement as captured, which is the one behavioural difference
 * from live mode and is documented at the call site.
 */

const store = new Map<string, PaymentSnapshot>();

export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock" as const;

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    // Run the real fiscal maths even though nothing is submitted. This is the
    // point of mock mode: everything except the network is exercised.
    const fiscal = buildFiscalisationData(input.lines, input.deliveryFeeCents);
    assertFiscalTotalsBalance(fiscal, input.amountCents);

    // globalThis.crypto rather than node:crypto: the node: scheme drags this
    // module into bundling layers that cannot resolve it.
    const transactionId = `mock_${globalThis.crypto.randomUUID()}`;
    const reference = `mock_${input.orderCode}`;

    store.set(transactionId, {
      transactionId,
      reference,
      status: "captured",
      amountCents: input.amountCents,
      merchantReference: input.orderCode,
    });

    return { reference: transactionId, redirectUrl: null, settledImmediately: true };
  }

  async getPayment(transactionId: string): Promise<PaymentSnapshot | null> {
    return store.get(transactionId) ?? null;
  }

  async refundPayment(
    transactionId: string,
    amountCents: number,
  ): Promise<RefundResult> {
    const existing = store.get(transactionId);
    if (!existing) {
      // Mock state lives in memory and is lost on restart. A refund for a
      // payment this process never saw still succeeds, because in mock mode no
      // real money exists to get stuck.
      return { ok: true, reference: `mock_refund_${transactionId}` };
    }
    if (amountCents > existing.amountCents) {
      return { ok: false, error: "refund exceeds captured amount" };
    }
    store.set(transactionId, { ...existing, status: "refunded" });
    return { ok: true, reference: `mock_refund_${transactionId}` };
  }

  /**
   * Mock mode has no webhook. Returning null means "not authentic", so if
   * anything ever POSTs to the webhook endpoint while in mock mode it is
   * ignored rather than trusted.
   */
  async verifyWebhook(): Promise<VerifiedPaymentEvent | null> {
    return null;
  }

  webhookActivationKey(): string | null {
    return null;
  }
}
