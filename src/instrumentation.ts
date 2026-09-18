/**
 * Runs once when the server boots, before any request is served.
 *
 * Both checks are deliberately fatal: a production deployment that fakes
 * payments, or one that serves an unauthenticated admin panel, should fail to
 * start rather than quietly run.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { assertDevBypassSafe, DEV_BYPASS } = await import("./lib/dev-mode");
  const { assertPaymentModeConfigured, PAYMENT_MODE } = await import("./lib/payments");
  assertDevBypassSafe();
  assertPaymentModeConfigured();
  console.info(`[payments] PAYMENT_MODE=${PAYMENT_MODE}`);

  const { assertFiscalisationReadyForProduction } = await import(
    "./lib/viva-fiscalisation"
  );
  assertFiscalisationReadyForProduction();

  if (DEV_BYPASS) {
    console.warn(
      "\n  ┌──────────────────────────────────────────────────────────────┐\n" +
        "  │  TEST MODE (DEV_BYPASS)                                      │\n" +
        "  │  · /admin is open with NO login                              │\n" +
        "  │  · card and IRIS payments are faked, Viva is never called    │\n" +
        "  │  Never set this outside local development.                   │\n" +
        "  └──────────────────────────────────────────────────────────────┘\n",
    );
  }
}
