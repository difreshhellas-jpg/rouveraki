import "server-only";
import type { PaymentProvider } from "./types";
import { MockPaymentProvider } from "./mock";
import { VivaPaymentProvider } from "./viva-provider";

/**
 * ============================================================================
 *  THE PAYMENT SWITCH
 * ============================================================================
 *
 *  ONE environment variable decides everything:
 *
 *      PAYMENT_MODE=mock   (default)  no network call, auto-confirms,
 *                                     fake transaction reference
 *      PAYMENT_MODE=live              real Viva Smart Checkout + real
 *                                     fiscalisation + verified webhooks
 *
 *  Both modes implement the same PaymentProvider interface, so there is
 *  exactly one code path above this file. No `if (mock)` branches in routes,
 *  no parallel functions to keep in sync. To go live: set PAYMENT_MODE=live
 *  and supply the Viva credentials. Nothing else changes.
 *
 *  Mock mode is NOT a stub. It builds the same fiscalisationData object and
 *  asserts the VAT lines balance to the cent, so a fiscal error is caught on a
 *  test order rather than on the first real receipt.
 *
 *  Safety rail: asking for live mode without full credentials throws at
 *  startup rather than silently falling back to mock and taking fake money.
 * ========================================================================= */

export type PaymentMode = "mock" | "live";

export const PAYMENT_MODE: PaymentMode =
  process.env.PAYMENT_MODE === "live" ? "live" : "mock";

const requiredLiveVars = [
  "VIVA_CLIENT_ID",
  "VIVA_CLIENT_SECRET",
  "VIVA_WEBHOOK_VERIFICATION_KEY",
] as const;

export function missingLiveCredentials(): string[] {
  return requiredLiveVars.filter((v) => !process.env[v]);
}

/** Called from instrumentation at boot. */
export function assertPaymentModeConfigured(): void {
  if (PAYMENT_MODE !== "live") return;

  const missing = missingLiveCredentials();
  if (missing.length) {
    throw new Error(
      `PAYMENT_MODE=live but these are not set: ${missing.join(", ")}. ` +
        "Refusing to start: a live payment path without credentials would " +
        "fail every order at checkout.",
    );
  }
  if (!process.env.VIVA_WEBHOOK_SECRET) {
    console.warn(
      "[payments] PAYMENT_MODE=live without VIVA_WEBHOOK_SECRET. Webhooks are " +
        "still verified by re-reading each transaction from Viva, but the " +
        "signature check is inactive. Set it.",
    );
  }
}

let cached: PaymentProvider | null = null;

/** The only way to get a payment provider. */
export function payments(): PaymentProvider {
  cached ??=
    PAYMENT_MODE === "live" ? new VivaPaymentProvider() : new MockPaymentProvider();
  return cached;
}

export * from "./types";
export {
  vatCategoryForCategory,
  vatRateForCategory,
  buildFiscalisationData,
  splitVat,
} from "./fiscalisation";
