import { Prisma } from "@prisma/client";

/**
 * All arithmetic is done in integer cents. Prisma Decimal values are converted
 * at the edges only — never add two floats together anywhere in this app.
 */
export const toCents = (v: Prisma.Decimal | number | string): number =>
  Math.round(Number(v) * 100);

export const fromCents = (cents: number): number => cents / 100;

export const toDecimal = (cents: number): Prisma.Decimal =>
  new Prisma.Decimal((cents / 100).toFixed(2));

/** Formats as 4,50 EUR — Greek locale uses a comma decimal separator. */
export const formatEuro = (
  v: number | string | Prisma.Decimal,
  locale = "el-GR",
): string =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(Number(v));
