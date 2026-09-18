/**
 * Viva.com Smart Checkout client.
 *
 * Flow:
 *   1. createPaymentOrder()  -> Viva returns a numeric orderCode
 *   2. we redirect the customer to checkoutUrl(orderCode)
 *   3. Viva redirects back to /checkout/return and (independently) POSTs a
 *      webhook to /api/webhooks/viva
 *   4. the webhook handler calls getTransaction() and trusts THAT, not the
 *      webhook body — see the note in api/webhooks/viva/route.ts
 *
 * No card data ever reaches this server; the customer enters it on Viva's page.
 */

type VivaEnv = "demo" | "production";

const env: VivaEnv =
  process.env.VIVA_ENVIRONMENT === "production" ? "production" : "demo";

const HOSTS = {
  demo: {
    accounts: "https://demo-accounts.vivapayments.com",
    api: "https://demo-api.vivapayments.com",
    checkout: "https://demo.vivapayments.com",
  },
  production: {
    accounts: "https://accounts.vivapayments.com",
    api: "https://api.vivapayments.com",
    checkout: "https://www.vivapayments.com",
  },
} as const;

const host = HOSTS[env];

export const vivaIsConfigured = (): boolean =>
  Boolean(process.env.VIVA_CLIENT_ID && process.env.VIVA_CLIENT_SECRET);

const requireEnv = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
};

/* ---- OAuth2 client-credentials token, cached until shortly before expiry -- */

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  const basic = Buffer.from(
    `${requireEnv("VIVA_CLIENT_ID")}:${requireEnv("VIVA_CLIENT_SECRET")}`,
  ).toString("base64");

  const res = await fetch(`${host.accounts}/connect/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Viva token request failed: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return cachedToken.value;
}

async function vivaFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  return fetch(`${host.api}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
}

/* ---- payment order ------------------------------------------------------ */

export type CreatePaymentOrderInput = {
  /** Integer cents. Viva takes the amount in the currency's minor unit. */
  amountCents: number;
  /** Shown on the Viva payment page and on the customer's statement. */
  description: string;
  /** Our own order code, echoed back on the webhook as merchantTrns. */
  merchantReference: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  /** 'iris' | 'card' — used to preselect a method on the Viva page. */
  preferredMethod?: "iris" | "card";
  /**
   * Greek fiscal receipt payload. Viva issues the retail receipt and reports it
   * to AADE from this. Built in payments/fiscalisation.ts; never hand-assembled
   * at a call site.
   */
  fiscalisationData?: unknown;
};

export type CreatePaymentOrderResult = {
  orderCode: string;
  redirectUrl: string;
};

export async function createPaymentOrder(
  input: CreatePaymentOrderInput,
): Promise<CreatePaymentOrderResult> {
  /**
   * TODO:OWNER — Viva's numeric paymentMethodId values differ per account and
   * per enabled product. Read the exact IDs for "Card" and "IRIS" off the Viva
   * dashboard (Settings > API Access > Payment methods) and put them in
   * VIVA_PAYMENT_METHOD_ID_CARD / VIVA_PAYMENT_METHOD_ID_IRIS. Until those are
   * set we send no preselection, which makes Viva show every method enabled on
   * the account — correct, just one extra tap for the customer.
   */
  const methodEnv =
    input.preferredMethod === "iris"
      ? process.env.VIVA_PAYMENT_METHOD_ID_IRIS
      : input.preferredMethod === "card"
        ? process.env.VIVA_PAYMENT_METHOD_ID_CARD
        : undefined;

  const paymentMethodIds = methodEnv
    ? methodEnv.split(",").map((s) => Number(s.trim())).filter(Number.isFinite)
    : undefined;

  const body: Record<string, unknown> = {
    amount: input.amountCents,
    customerTrns: input.description,
    // merchantTrns is our reconciliation key — it comes back on the webhook.
    merchantTrns: input.merchantReference,
    customer: {
      email: input.customerEmail,
      fullName: input.customerName,
      phone: input.customerPhone,
      countryCode: "GR",
      requestLang: "el-GR",
    },
    // Minutes the payment link stays valid. Long enough for a slow checkout,
    // short enough that a stale link cannot be paid an hour later.
    paymentTimeout: 1800,
    preauth: false,
    allowRecurring: false,
    maxInstallments: 0,
    forceMaxInstallments: false,
    disableExactAmount: false,
    disableCash: true,
    disableWallet: false,
    sourceCode: process.env.VIVA_SOURCE_CODE || undefined,
    tags: ["rouveraki-web"],
  };
  if (paymentMethodIds?.length) body.paymentMethodIds = paymentMethodIds;
  if (input.fiscalisationData) body.fiscalisationData = input.fiscalisationData;

  const res = await vivaFetch("/checkout/v2/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Viva createPaymentOrder failed: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as { orderCode: number | string };
  const orderCode = String(json.orderCode);
  return { orderCode, redirectUrl: checkoutUrl(orderCode) };
}

export const checkoutUrl = (orderCode: string): string =>
  `${host.checkout}/web/checkout?ref=${encodeURIComponent(orderCode)}`;

/* ---- transaction lookup (the source of truth for "is it paid?") --------- */

export type VivaTransaction = {
  transactionId: string;
  orderCode: string;
  /** Viva statusId 'F' = finished/captured. Anything else is not money in hand. */
  statusId: string;
  amount: number;
  merchantTrns?: string;
  customerTrns?: string;
  cardNumber?: string;
  paymentMethodId?: number;
  insDate?: string;
};

export async function getTransaction(
  transactionId: string,
): Promise<VivaTransaction | null> {
  const res = await vivaFetch(
    `/checkout/v2/transactions/${encodeURIComponent(transactionId)}`,
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Viva getTransaction failed: ${res.status} ${await res.text()}`);
  }
  const t = (await res.json()) as Record<string, unknown>;
  return {
    transactionId: String(t.transactionId ?? transactionId),
    orderCode: String(t.orderCode ?? ""),
    statusId: String(t.statusId ?? ""),
    // Viva returns this one in major units (euros), unlike the create call.
    amount: Number(t.amount ?? 0),
    merchantTrns: t.merchantTrns ? String(t.merchantTrns) : undefined,
    customerTrns: t.customerTrns ? String(t.customerTrns) : undefined,
    cardNumber: t.cardNumber ? String(t.cardNumber) : undefined,
    paymentMethodId:
      typeof t.paymentMethodId === "number" ? t.paymentMethodId : undefined,
    insDate: t.insDate ? String(t.insDate) : undefined,
  };
}

/** A captured, settled transaction. */
export const isCaptured = (t: VivaTransaction): boolean => t.statusId === "F";

/* ---- refunds ------------------------------------------------------------ */

export type RefundResult = {
  ok: boolean;
  reference?: string;
  error?: string;
};

/**
 * Full or partial refund of a captured transaction.
 *
 * NOTE FOR PART 2 — a refund is only half the job. The matching *fiscal*
 * document (credit note) still has to be issued through Viva Fiscalisation;
 * see src/lib/viva-fiscalisation.ts. Do not treat a successful refund here as
 * a completed cancellation until that side is built.
 */
export async function refundTransaction(
  transactionId: string,
  amountCents: number,
  sourceCode?: string,
): Promise<RefundResult> {
  const params = new URLSearchParams({ amount: String(amountCents) });
  if (sourceCode ?? process.env.VIVA_SOURCE_CODE) {
    params.set("sourceCode", sourceCode ?? process.env.VIVA_SOURCE_CODE!);
  }

  const res = await vivaFetch(
    `/checkout/v2/transactions/${encodeURIComponent(transactionId)}?${params}`,
    { method: "DELETE" },
  );

  if (!res.ok) {
    return { ok: false, error: `${res.status} ${await res.text()}` };
  }
  const json = (await res.json().catch(() => ({}))) as { transactionId?: string };
  return { ok: true, reference: json.transactionId ?? transactionId };
}

export const vivaEnvironment = env;
