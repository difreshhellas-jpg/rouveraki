import type { FiscalLine } from "./types";

/**
 * Greek fiscal data for Viva "Fiscalisation for Online Sales".
 *
 * This builds the `fiscalisationData` object that rides along on the same
 * payment-order call. Viva issues the retail receipt and reports it to AADE via
 * myDATA, so the numbers here have to be right.
 *
 * THE PART THAT MATTERS FOR ROUVERAKI: food service and alcohol are not the
 * same VAT rate in Greece. A menu that spans coffee, souvlaki and spirits
 * cannot use one blanket rate, which is exactly the mistake that makes a
 * fiscal integration quietly wrong for months.
 *
 * TODO:ACCOUNTANT — confirm all four before switching PAYMENT_MODE to live:
 *   1. The rates below (currently 13% food service / 24% alcohol and bottled
 *      goods). A business operating as a restaurant vs a takeaway can differ.
 *   2. The myDATA income classification codes.
 *   3. Whether the delivery fee carries its own rate or follows the food.
 *   4. The credit-note flow for a refund, which is a separate document.
 */

/** Viva VAT category ids. 1 = 24%, 2 = 13%, 3 = 6% for the standard mainland rates. */
export const VAT_CATEGORY = {
  RATE_24: 1,
  RATE_13: 2,
  RATE_6: 3,
} as const;

export const VAT_RATE = {
  [VAT_CATEGORY.RATE_24]: 0.24,
  [VAT_CATEGORY.RATE_13]: 0.13,
  [VAT_CATEGORY.RATE_6]: 0.06,
} as const;

/**
 * Category slug to VAT treatment. Alcohol is the only 24% band on this menu;
 * everything else is served food and drink at 13%.
 */
const CATEGORY_VAT: Record<string, number> = {
  pota: VAT_CATEGORY.RATE_24,
  mpyres: VAT_CATEGORY.RATE_24,
  anapsyktika: VAT_CATEGORY.RATE_13,
  chymoi: VAT_CATEGORY.RATE_13,
  kafedes: VAT_CATEGORY.RATE_13,
  rofimata: VAT_CATEGORY.RATE_13,
  pites: VAT_CATEGORY.RATE_13,
  kalamakia: VAT_CATEGORY.RATE_13,
  merides: VAT_CATEGORY.RATE_13,
  poikilies: VAT_CATEGORY.RATE_13,
  burger: VAT_CATEGORY.RATE_13,
  santouits: VAT_CATEGORY.RATE_13,
  psari: VAT_CATEGORY.RATE_13,
  zymarika: VAT_CATEGORY.RATE_13,
  orektika: VAT_CATEGORY.RATE_13,
  salates: VAT_CATEGORY.RATE_13,
};

export const vatCategoryForCategory = (category: string): number =>
  CATEGORY_VAT[category] ?? VAT_CATEGORY.RATE_13;

export const vatRateForCategory = (category: string): number =>
  VAT_RATE[vatCategoryForCategory(category) as keyof typeof VAT_RATE];

/** Delivery follows the food rate unless the accountant says otherwise. */
export const DELIVERY_VAT_CATEGORY = VAT_CATEGORY.RATE_13;

/**
 * Splits a VAT-inclusive amount into net and VAT, in cents.
 * Rounds the VAT and derives net from it, so net + vat always equals gross
 * exactly. Deriving both independently is how a receipt ends up one cent out.
 */
export function splitVat(
  grossCents: number,
  rate: number,
): { netCents: number; vatCents: number } {
  const netExact = grossCents / (1 + rate);
  const netCents = Math.round(netExact);
  return { netCents, vatCents: grossCents - netCents };
}

export type FiscalLineItem = {
  name: string;
  quantity: number;
  netAmount: number;
  vatAmount: number;
  vatCategory: number;
  measurementUnit: number;
  incomeClassificationType: string;
  incomeClassificationCategory: string;
};

export type FiscalisationData = {
  fiscalReceiptType: number;
  currencyCode: string;
  netAmount: number;
  vatAmount: number;
  totalAmount: number;
  lineItems: FiscalLineItem[];
};

/**
 * myDATA classification for retail food service revenue.
 * TODO:ACCOUNTANT — confirm these two codes for this business's activity.
 */
const INCOME_CLASSIFICATION_TYPE = "E3_561_003";
const INCOME_CLASSIFICATION_CATEGORY = "category1_3";

/** Viva expresses amounts in major units (euros) inside fiscalisationData. */
const toEuros = (cents: number): number => Number((cents / 100).toFixed(2));

export function buildFiscalisationData(
  lines: FiscalLine[],
  deliveryFeeCents: number,
): FiscalisationData {
  const lineItems: FiscalLineItem[] = [];
  let netTotal = 0;
  let vatTotal = 0;
  let grossTotal = 0;

  for (const line of lines) {
    const { netCents, vatCents } = splitVat(line.totalCents, line.vatRate);
    netTotal += netCents;
    vatTotal += vatCents;
    grossTotal += line.totalCents;

    lineItems.push({
      name: line.name.slice(0, 100),
      quantity: line.quantity,
      netAmount: toEuros(netCents),
      vatAmount: toEuros(vatCents),
      vatCategory: line.vatCategoryCode,
      // 1 = pieces. Nothing on this menu is sold by weight or volume.
      measurementUnit: 1,
      incomeClassificationType: INCOME_CLASSIFICATION_TYPE,
      incomeClassificationCategory: INCOME_CLASSIFICATION_CATEGORY,
    });
  }

  if (deliveryFeeCents > 0) {
    const rate = VAT_RATE[DELIVERY_VAT_CATEGORY as keyof typeof VAT_RATE];
    const { netCents, vatCents } = splitVat(deliveryFeeCents, rate);
    netTotal += netCents;
    vatTotal += vatCents;
    grossTotal += deliveryFeeCents;

    lineItems.push({
      name: "Κόστος διανομής",
      quantity: 1,
      netAmount: toEuros(netCents),
      vatAmount: toEuros(vatCents),
      vatCategory: DELIVERY_VAT_CATEGORY,
      measurementUnit: 1,
      incomeClassificationType: INCOME_CLASSIFICATION_TYPE,
      incomeClassificationCategory: INCOME_CLASSIFICATION_CATEGORY,
    });
  }

  return {
    // 1 = retail receipt (ΑΠΟΔΕΙΞΗ ΛΙΑΝΙΚΗΣ). A credit note is a different type
    // and is issued on the refund path, not here.
    fiscalReceiptType: 1,
    currencyCode: "EUR",
    netAmount: toEuros(netTotal),
    vatAmount: toEuros(vatTotal),
    totalAmount: toEuros(grossTotal),
    lineItems,
  };
}

/**
 * Sanity check used by the test suite and by the live-mode startup guard: the
 * line items must add back up to the order total, to the cent.
 */
export function assertFiscalTotalsBalance(
  data: FiscalisationData,
  expectedTotalCents: number,
): void {
  const sum = data.lineItems.reduce(
    (n, li) => n + Math.round((li.netAmount + li.vatAmount) * 100),
    0,
  );
  if (sum !== expectedTotalCents) {
    throw new Error(
      `Fiscal line items total ${sum} cents but the order is ${expectedTotalCents} cents`,
    );
  }
}
