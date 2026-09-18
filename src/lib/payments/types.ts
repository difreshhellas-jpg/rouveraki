/**
 * The single payment contract. Both the mock provider and the live Viva
 * provider implement exactly this, so nothing above this layer knows or cares
 * which one is running.
 */

export type PaymentMethod = "iris" | "card" | "cash";

export type CreatePaymentInput = {
  orderId: number;
  /** Our own order code. Comes back on the webhook as the merchant reference. */
  orderCode: string;
  amountCents: number;
  method: Exclude<PaymentMethod, "cash">;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  /** Per-line VAT data for the fiscal receipt. See fiscalisation.ts. */
  lines: FiscalLine[];
  deliveryFeeCents: number;
};

export type CreatePaymentResult = {
  /** Provider reference for the payment attempt (Viva orderCode, or a mock id). */
  reference: string;
  /**
   * Where to send the customer. Null means no redirect is needed — the mock
   * provider confirms server-side, so checkout goes straight to tracking.
   */
  redirectUrl: string | null;
  /** True when the provider settles without a round trip (mock only). */
  settledImmediately: boolean;
};

export type PaymentStatus = "pending" | "captured" | "failed" | "refunded";

export type PaymentSnapshot = {
  transactionId: string;
  reference: string;
  status: PaymentStatus;
  amountCents: number;
  /** Our order code, as the provider recorded it. */
  merchantReference: string | null;
};

export type RefundResult = {
  ok: boolean;
  reference?: string;
  error?: string;
};

/**
 * A webhook that has been *verified* — signature checked and, where the
 * provider supports it, the transaction re-read from the provider's own API.
 * Anything that fails verification never becomes one of these.
 */
export type VerifiedPaymentEvent = {
  kind: "payment_captured" | "payment_failed" | "refund_created";
  transactionId: string;
  merchantReference: string;
  amountCents: number;
  /** Stable id used for the idempotency ledger. */
  eventId: string;
  raw: unknown;
};

/** One order line, with the VAT treatment the fiscal receipt needs. */
export type FiscalLine = {
  name: string;
  quantity: number;
  unitPriceCents: number;
  /** Gross (VAT-inclusive) total for the line. */
  totalCents: number;
  vatRate: number;
  vatCategoryCode: number;
};

export interface PaymentProvider {
  readonly name: "mock" | "viva";
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  getPayment(transactionId: string): Promise<PaymentSnapshot | null>;
  refundPayment(transactionId: string, amountCents: number): Promise<RefundResult>;
  /**
   * Verifies an incoming webhook. Returns null when the request is not
   * authentic — callers must treat null as "ignore", never as "assume paid".
   */
  verifyWebhook(
    req: Request,
    rawBody: string,
  ): Promise<VerifiedPaymentEvent | null>;
  /** The key Viva fetches to activate a webhook; null for providers with no such step. */
  webhookActivationKey(): string | null;
}
