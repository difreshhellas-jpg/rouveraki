import { BRAND } from "./brand";
/** Real opening hours apply in ordering mode too. Set NEXT_PUBLIC_IGNORE_HOURS=true
 *  only to test ordering outside opening hours. */
const IGNORE_HOURS = process.env.NEXT_PUBLIC_IGNORE_HOURS === "true";

/**
 * Opening-hours maths. Shop 06:00–24:00, delivery 12:00–24:00. A closes value
 * of "00:00" means midnight at the end of the day, handled in within().
 *
 * Everything resolves in Europe/Athens regardless of where the server or the
 * visitor's device is set, so a customer abroad checking the site sees the
 * shop's real state, not their own.
 */
export const TZ = "Europe/Athens";

/**
 * Test clock, honoured only outside production.
 *
 * The shop is shut between 00:00 and 06:00, so every order check in the API
 * suite fails with shop_closed if it happens to run overnight — the suite was
 * silently time-dependent. TEST_CLOCK pins "now" to a fixed instant so the
 * suite is runnable at any hour.
 *
 * Refused outright when NODE_ENV is production, so it can never move a real
 * customer's clock or hold the shop open past closing.
 */
const testClock = (): Date | null => {
  if (process.env.NODE_ENV === "production") return null;
  const raw = process.env.TEST_CLOCK;
  if (!raw) return null;
  const at = new Date(raw);
  return Number.isNaN(at.getTime()) ? null : at;
};

/** Minutes since local midnight in Athens. */
export const athensMinutes = (at: Date = testClock() ?? new Date()): number => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  // Intl renders midnight as "24" in some ICU builds.
  return (h % 24) * 60 + m;
};

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/**
 * True when `minutes` falls inside [opens, closes), handling a window that
 * wraps midnight. A closes value of "00:00" means midnight at the END of the
 * day, i.e. 24:00, not the start.
 */
const within = (minutes: number, opens: string, closes: string): boolean => {
  const o = toMinutes(opens);
  const c = closes === "00:00" ? 24 * 60 : toMinutes(closes);
  return o < c ? minutes >= o && minutes < c : minutes >= o || minutes < c;
};

export const isShopOpen = (at?: Date): boolean =>
  IGNORE_HOURS || within(athensMinutes(at), BRAND.hours.opens, BRAND.hours.closes);

export const isDeliveryOpen = (at?: Date): boolean =>
  IGNORE_HOURS || within(athensMinutes(at), BRAND.deliveryHours.opens, BRAND.deliveryHours.closes);

/**
 * Municipal alcohol-hour restriction (spec §6, second bullet).
 *
 * TODO:OWNER — one phone call to the municipality confirms whether Xylokastro
 * restricts the hours during which alcohol may be sold or delivered, separately
 * from the shop's own opening hours. If it does, set ALCOHOL_HOURS below and
 * flip ALCOHOL_HOURS_RESTRICTED to true; the cart, the menu and the order API
 * all read this one flag, so nothing else needs to change.
 */
export const ALCOHOL_HOURS_RESTRICTED = false;
export const ALCOHOL_HOURS = { opens: "08:00", closes: "00:00" } as const;

export const isAlcoholSaleAllowed = (at?: Date): boolean =>
  !ALCOHOL_HOURS_RESTRICTED ||
  within(athensMinutes(at), ALCOHOL_HOURS.opens, ALCOHOL_HOURS.closes);

/** "06:00–00:00" for display. */
export const formatWindow = (w: { opens: string; closes: string }): string =>
  `${w.opens}–${w.closes}`;
