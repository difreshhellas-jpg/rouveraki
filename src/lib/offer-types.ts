/** One offer the owner shows on the site (display only: prices come from the menu). */
export type Offer = {
  id: string;
  title: string;
  titleEn: string | null;
  text: string | null;
  textEn: string | null;
  /** Short highlight, e.g. "-20%" or "2+1". */
  badge: string | null;
  /** Shown on the site only while true. */
  active: boolean;
  /** Optional last day (YYYY-MM-DD, Greek time); hidden after it. */
  endsOn: string | null;
};

/** Today in Greece as YYYY-MM-DD. */
export const athensToday = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(now);

/** Offers customers should see right now. */
export const liveOffers = (offers: Offer[], now = new Date()) => {
  const today = athensToday(now);
  return offers.filter((o) => o.active && (!o.endsOn || o.endsOn >= today));
};
