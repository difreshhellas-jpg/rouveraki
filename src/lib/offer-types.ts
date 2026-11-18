import type { MenuItemDTO } from "@/lib/menu-types";

/**
 * What an offer does to prices.
 *  - "item": this product costs priceCents for everyone while the offer runs.
 *  - "addon": suggested at checkout ("Coca-Cola with that, only +2 €"). It
 *    costs priceCents once per qualifying product in the order: a product in
 *    one of `withCategories`, or any product when that list is empty.
 */
export type OfferDeal =
  | { kind: "item"; itemId: number; priceCents: number }
  | { kind: "addon"; itemId: number; priceCents: number; withCategories: string[] };

/** One offer the owner shows on the site. Without a deal it is an announcement only. */
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
  deal?: OfferDeal | null;
};

/** The product a deal is about, as the public API sends it with the offer. */
export type DealItem = Pick<MenuItemDTO, "id" | "name" | "nameEn" | "priceCents" | "category" | "image" | "available">;
export type PublicOffer = Offer & { item?: DealItem | null };

/** Today in Greece as YYYY-MM-DD. */
export const athensToday = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(now);

/** Offers customers should see right now. */
export const liveOffers = <T extends Offer>(offers: T[], now = new Date()): T[] => {
  const today = athensToday(now);
  return offers.filter((o) => o.active && (!o.endsOn || o.endsOn >= today));
};

/** Special prices by product id, from the live "item" deals (lowest wins). */
export function itemDealPrices(offers: Offer[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const o of offers) {
    const d = o.deal;
    if (d?.kind !== "item") continue;
    const prev = out.get(d.itemId);
    if (prev === undefined || d.priceCents < prev) out.set(d.itemId, d.priceCents);
  }
  return out;
}

/** Menu items with live special prices applied (wasPriceCents keeps the normal one). */
export function applyItemDeals(items: MenuItemDTO[], offers: Offer[]): MenuItemDTO[] {
  const prices = itemDealPrices(offers);
  if (prices.size === 0) return items;
  return items.map((m) => {
    const p = prices.get(m.id);
    return p !== undefined && p < m.priceCents ? { ...m, priceCents: p, wasPriceCents: m.priceCents } : m;
  });
}

/**
 * How many add-ons an order may have at the offer price: one per qualifying
 * product (add-on lines themselves never qualify).
 */
export function addonAllowance(
  deal: Extract<OfferDeal, { kind: "addon" }>,
  lines: { category: string; quantity: number; offerId?: string | null }[],
): number {
  return lines
    .filter((l) => !l.offerId && (deal.withCategories.length === 0 || deal.withCategories.includes(l.category)))
    .reduce((n, l) => n + l.quantity, 0);
}
