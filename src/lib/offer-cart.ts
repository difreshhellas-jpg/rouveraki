"use client";

import type { CartLine } from "@/store/cart";
import type { DealItem, PublicOffer, PublicRecommendation } from "@/lib/offer-types";

type NewLine = Omit<CartLine, "lineId" | "quantity"> & { quantity?: number };

const line = (m: DealItem, unitPriceCents: number, offerId: string | null): NewLine => ({
  menuItemId: m.id,
  name: m.name,
  nameEn: m.nameEn,
  unitPriceCents,
  quantity: 1,
  itemNotes: "",
  requiresAgeVerification: false,
  image: m.image,
  category: m.category,
  offerId,
});

/**
 * The cart lines for an offer at its offer price: one line, or one per
 * product of a combo (all tagged with the offer). Empty when it cannot be
 * bought now.
 */
export function dealLines(o: PublicOffer): NewLine[] {
  const d = o.deal;
  if (!d) return [];
  if (d.kind === "combo") {
    const items = o.items ?? [];
    if (items.length !== d.items.length || items.some((m) => !m.available)) return [];
    return d.items.map((p) => ({ ...line(items.find((m) => m.id === p.itemId)!, p.priceCents, o.id), combo: o.title }));
  }
  const m = o.item;
  if (!m || !m.available) return [];
  // Only add-ons are separate lines; a special price applies to every portion.
  return [line(m, d.priceCents, d.kind === "addon" ? o.id : null)];
}

/** A recommendation is an ordinary line at the normal price. */
export const recommendationLine = (r: PublicRecommendation): NewLine => line(r.item, r.item.priceCents, null);

/** Normal price of a combo's products bought one by one. */
export const comboRegularCents = (o: PublicOffer) => (o.items ?? []).reduce((n, m) => n + m.priceCents, 0);
