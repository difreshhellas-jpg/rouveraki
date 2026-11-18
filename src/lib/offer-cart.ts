"use client";

import type { CartLine } from "@/store/cart";
import type { PublicOffer } from "@/lib/offer-types";

type NewLine = Omit<CartLine, "lineId" | "quantity"> & { quantity?: number };

/** The cart line for an offer's product at the offer price (null if it cannot be bought now). */
export function dealLine(o: PublicOffer): NewLine | null {
  const d = o.deal;
  const m = o.item;
  if (!d || !m || !m.available) return null;
  return {
    menuItemId: m.id,
    name: m.name,
    nameEn: m.nameEn,
    unitPriceCents: d.priceCents,
    quantity: 1,
    itemNotes: "",
    requiresAgeVerification: false,
    image: m.image,
    category: m.category,
    // Only add-ons are separate lines; a special price applies to every portion.
    offerId: d.kind === "addon" ? o.id : null,
  };
}
