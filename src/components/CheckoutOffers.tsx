"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/LanguageProvider";
import { formatEuro } from "@/lib/money";
import { useCart } from "@/store/cart";
import { useOffers } from "@/lib/use-offers";
import { dealLine } from "@/lib/offer-cart";
import { addonAllowance, type PublicOffer } from "@/lib/offer-types";

/**
 * Offers at checkout:
 *  - add-on suggestions ("Coca-Cola with that? Only +2 €"), one per
 *    qualifying product, kept in step with the cart;
 *  - special prices the cart is not using yet, with one tap to add;
 *  - lines added before an offer started get its price.
 */
export default function CheckoutOffers() {
  const data = useOffers();
  const { pick, locale } = useI18n();
  const en = locale === "en";
  const lines = useCart((s) => s.lines);
  const addLine = useCart((s) => s.addLine);
  const setQuantity = useCart((s) => s.setQuantity);
  const setItemPrice = useCart((s) => s.setItemPrice);
  const money = (c: number) => formatEuro(c / 100, en ? "en-IE" : "el-GR");
  const offers = data?.offers ?? [];

  // Keep the cart honest with the offers that are live now.
  useEffect(() => {
    if (!data) return;
    for (const o of data.offers) {
      const d = o.deal;
      if (d?.kind === "item") {
        for (const l of lines) {
          if (l.menuItemId === d.itemId && !l.offerId && l.unitPriceCents !== d.priceCents) {
            setItemPrice(d.itemId, d.priceCents);
          }
        }
      }
    }
    // Add-ons beyond what the order earns (or for an offer that ended) go.
    for (const l of lines) {
      if (!l.offerId) continue;
      const o = data.offers.find((x) => x.id === l.offerId);
      const allowed = o?.deal?.kind === "addon" ? addonAllowance(o.deal, lines) : 0;
      if (l.quantity > allowed) setQuantity(l.lineId, allowed);
    }
  }, [data, lines, setItemPrice, setQuantity]);

  const suggestions = offers.flatMap((o) => {
    const d = o.deal;
    if (!d || !o.item?.available) return [];
    if (d.kind === "addon") {
      const used = lines.filter((l) => l.offerId === o.id).reduce((n, l) => n + l.quantity, 0);
      return addonAllowance(d, lines) > used ? [o] : [];
    }
    return lines.some((l) => l.menuItemId === d.itemId) ? [] : [o];
  });
  if (suggestions.length === 0) return null;

  const add = (o: PublicOffer) => {
    const line = dealLine(o);
    if (!line) return;
    // No toast: the line appears right above, and a toast would follow the
    // customer onto the order page.
    addLine(line);
  };

  return (
    <section aria-label={en ? "Offers for you" : "Προσφορές για σένα"} className="space-y-3">
      {suggestions.map((o) => {
        const d = o.deal!;
        const item = o.item!;
        const name = pick(item.name, item.nameEn);
        const question =
          d.kind === "addon"
            ? en
              ? `Want ${name} with that?`
              : `Θέλεις και ${name};`
            : (en && o.titleEn) || o.title;
        return (
          <div key={o.id} className="flex items-center gap-3 rounded-card border-2 border-gold bg-gold/10 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-snug">
                {o.badge && <span className="mr-2 rounded-full bg-rust px-2 py-0.5 text-xs text-onrust">{o.badge}</span>}
                {question}
              </p>
              <p className="mt-0.5 text-sm">
                <s className="mr-1.5 text-char/45">{money(item.priceCents)}</s>
                <span className="font-bold text-rust">
                  {d.kind === "addon" ? (en ? "only +" : "μόνο +") : en ? "only " : "μόνο "}
                  {money(d.priceCents)}
                </span>
              </p>
            </div>
            <button type="button" onClick={() => add(o)} className="btn-primary shrink-0 text-sm">
              {en ? "Add" : "Πρόσθεσε"}
            </button>
          </div>
        );
      })}
    </section>
  );
}
