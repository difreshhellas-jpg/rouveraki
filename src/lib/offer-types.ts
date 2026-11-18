import type { MenuItemDTO } from "@/lib/menu-types";

/**
 * What an offer does to prices.
 *  - "item": this product costs priceCents for everyone while the offer runs.
 *  - "addon": suggested at checkout ("Coca-Cola with that, only +2 €"). It
 *    costs priceCents once per qualifying product in the order: a product in
 *    one of `withCategories`, or any product when that list is empty.
 *  - "combo": these products together for priceCents. The total is split
 *    across the products when the owner saves (`items[].priceCents`), so the
 *    site and the server always charge the same saved numbers.
 */
export type ComboPart = { itemId: number; priceCents: number };
export type OfferDeal =
  | { kind: "item"; itemId: number; priceCents: number }
  | { kind: "addon"; itemId: number; priceCents: number; withCategories: string[] }
  | { kind: "combo"; items: ComboPart[]; priceCents: number };

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
  /** Banner photo; null = the deal product's photo, if any. */
  image?: string | null;
};

/** The product(s) a deal is about, as the public API sends them with the offer. */
export type DealItem = Pick<MenuItemDTO, "id" | "name" | "nameEn" | "priceCents" | "category" | "image" | "available">;
export type PublicOffer = Offer & { item?: DealItem | null; items?: DealItem[] };

/**
 * Checkout recommendations ("Θέλεις και πατάτες;"), at the product's normal
 * price. Shown when the cart has a product in one of `whenCategories`.
 */
export type Recommendation = {
  id: string;
  whenCategories: string[];
  itemId: number;
  active: boolean;
};
export type PublicRecommendation = Recommendation & { item: DealItem };

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
 * product (offer lines themselves never qualify).
 */
export function addonAllowance(
  deal: Extract<OfferDeal, { kind: "addon" }>,
  lines: { category: string; quantity: number; offerId?: string | null }[],
): number {
  return lines
    .filter((l) => !l.offerId && (deal.withCategories.length === 0 || deal.withCategories.includes(l.category)))
    .reduce((n, l) => n + l.quantity, 0);
}

/**
 * Splits a combo total across its products in proportion to their normal
 * prices; the last product takes the rounding remainder.
 */
export function splitCombo(totalCents: number, regular: { itemId: number; priceCents: number }[]): ComboPart[] {
  const sum = regular.reduce((n, r) => n + r.priceCents, 0);
  let left = totalCents;
  return regular.map((r, i) => {
    const share = i === regular.length - 1 ? left : Math.round((totalCents * r.priceCents) / Math.max(1, sum));
    left -= share;
    return { itemId: r.itemId, priceCents: share };
  });
}

/** A photo URL the site can show: a site path, or https on an allowed photo host. */
export function isAllowedImage(src: string): boolean {
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  try {
    const u = new URL(src);
    return (
      u.protocol === "https:" &&
      (u.hostname === "images.unsplash.com" ||
        u.hostname === "images.pexels.com" ||
        u.hostname.endsWith(".public.blob.vercel-storage.com") ||
        u.hostname.endsWith(".supabase.co"))
    );
  } catch {
    return false;
  }
}

/** The banner photo of an offer: its own, else its product's. */
export const offerImage = (o: PublicOffer): string | null =>
  o.image || o.item?.image || o.items?.find((i) => i.image)?.image || null;
