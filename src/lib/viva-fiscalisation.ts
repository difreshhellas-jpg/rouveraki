/**
 * ============================================================================
 *  PART 2 BOUNDARY — DELIBERATELY NOT IMPLEMENTED
 * ============================================================================
 *
 * Viva "Fiscalisation for Online Sales" issues the legally required Greek
 * retail receipt (and, on a cancellation, the credit note) and reports it to
 * AADE via myDATA. Getting the refund-side document flow wrong is a tax
 * problem, not a bug, so per the build plan this is left for a careful
 * premium-effort pass rather than guessed at now.
 *
 * What already exists for it:
 *   - payments / refunds tables carry the Viva references to attach a receipt to
 *   - recordFiscalEvent() is called from exactly two places (see callers), so
 *     wiring it up later is a local change, not a refactor
 *
 * What the Part 2 pass must settle:
 *   1. The exact `fiscalisationData` object Viva expects on order creation
 *      (line items, VAT category per line — food and alcohol are NOT the same
 *      VAT rate in Greece, and this menu contains both).
 *   2. Where the receipt reference is stored and how it is surfaced to the
 *      customer and to the accountant.
 *   3. The cancelled/refunded-order fiscal document flow, once Viva confirms in
 *      writing how it works for THIS account — full refund, partial refund, and
 *      a rejection that happens after capture are three different cases.
 *   4. Whether cash orders taken through the site need a document issued from
 *      the in-store Viva POS instead, and how the two are reconciled.
 *
 * Until that pass lands, this module records intent only. It never claims a
 * receipt was issued, and it never silently no-ops in production.
 */

export type FiscalEventKind = "SALE" | "REFUND";

export type FiscalEvent = {
  kind: FiscalEventKind;
  orderId: number;
  orderCode: string;
  amountCents: number;
  vivaTransactionId?: string | null;
  vivaRefundReference?: string | null;
};

export const FISCALISATION_IMPLEMENTED = false;

/**
 * Called at the two points where a fiscal document will be required. Today it
 * logs loudly; it must not be made to look successful before it is real.
 */
export async function recordFiscalEvent(event: FiscalEvent): Promise<void> {
  if (FISCALISATION_IMPLEMENTED) {
    throw new Error(
      "FISCALISATION_IMPLEMENTED was flipped on but no implementation exists.",
    );
  }
  console.warn(
    `[FISCAL:PENDING] ${event.kind} order=${event.orderCode} ` +
      `amount=${(event.amountCents / 100).toFixed(2)}EUR ` +
      `viva=${event.vivaTransactionId ?? event.vivaRefundReference ?? "-"} ` +
      `— no fiscal document issued (Part 2 not built).`,
  );
}

/**
 * Guard for the launch checklist: refuse to run in production with real Viva
 * credentials while fiscalisation is still a stub, unless someone has
 * explicitly acknowledged it. Called from the app's startup check.
 */
export function assertFiscalisationReadyForProduction(): void {
  const live =
    process.env.NODE_ENV === "production" &&
    process.env.VIVA_ENVIRONMENT === "production";
  const acknowledged = process.env.ALLOW_LIVE_WITHOUT_FISCALISATION === "true";

  if (live && !FISCALISATION_IMPLEMENTED && !acknowledged) {
    throw new Error(
      "Refusing to run live: Viva Fiscalisation is not implemented (Part 2). " +
        "Build it, or set ALLOW_LIVE_WITHOUT_FISCALISATION=true to override " +
        "deliberately and on the accountant's say-so.",
    );
  }
}
