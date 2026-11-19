"use client";

import { useEffect } from "react";
import { useI18n } from "@/i18n/LanguageProvider";
import { formatEuro } from "@/lib/money";
import { useCart } from "@/store/cart";
import { pickRecommendations, useOffers, useRecommendations } from "@/lib/use-offers";
import { comboRegularCents, dealLines, recommendationLine } from "@/lib/offer-cart";
import { addonAllowance, type PublicOffer, type PublicRecommendation } from "@/lib/offer-types";
import Image from "next/image";

/**
 * Offers and recommendations at checkout:
 *  - add-on offers ("Coca-Cola with that? Only +1,50 €"), one per qualifying
 *    product, kept in step with the cart;
 *  - special prices and combos the cart is not using yet;
 *  - up to three recommendations at normal price ("Θέλεις και πατάτες;");
 *  - lines added before an offer started get its price, and combos stay whole.
 */
export default function CheckoutOffers() {
  const data = useOffers();
  const recs = useRecommendations();
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
      if (d?.kind !== "item") continue;
      for (const l of lines) {
        if (l.menuItemId === d.itemId && !l.offerId && l.unitPriceCents !== d.priceCents) {
          setItemPrice(d.itemId, d.priceCents);
        }
      }
    }
    for (const l of lines) {
      if (!l.offerId) continue;
      const o = data.offers.find((x) => x.id === l.offerId);
      if (o?.deal?.kind === "combo") {
        // All products of a combo in the same number; the smallest wins.
        const mine = lines.filter((x) => x.offerId === o.id);
        const n = mine.length === o.deal.items.length ? Math.min(...mine.map((x) => x.quantity)) : 0;
        if (l.quantity !== n) setQuantity(l.lineId, n);
        continue;
      }
      // Add-ons beyond what the order earns (or for an offer that ended) go.
      const allowed = o?.deal?.kind === "addon" ? addonAllowance(o.deal, lines) : 0;
      if (l.quantity > allowed) setQuantity(l.lineId, allowed);
    }
  }, [data, lines, setItemPrice, setQuantity]);

  const offerSuggestions = offers.flatMap((o) => {
    const d = o.deal;
    if (!d || dealLines(o).length === 0) return [];
    if (d.kind === "addon") {
      const used = lines.filter((l) => l.offerId === o.id).reduce((n, l) => n + l.quantity, 0);
      return addonAllowance(d, lines) > used ? [o] : [];
    }
    if (d.kind === "combo") return lines.some((l) => l.offerId === o.id) ? [] : [o];
    return lines.some((l) => l.menuItemId === d.itemId) ? [] : [o];
  });
  const offerItemIds = new Set(offerSuggestions.flatMap((o) => (o.deal && o.deal.kind !== "combo" ? [o.deal.itemId] : [])));
  const recSuggestions = pickRecommendations(recs ?? [], lines).filter((r) => !offerItemIds.has(r.item.id));

  if (offerSuggestions.length === 0 && recSuggestions.length === 0) return null;

  const addOffer = (o: PublicOffer) => dealLines(o).forEach((l) => addLine(l));
  const addRec = (r: PublicRecommendation) => addLine(recommendationLine(r));

  return (
    <section aria-label={en ? "Suggestions for you" : "Προτάσεις για σένα"} className="space-y-3">
      {offerSuggestions.map((o) => {
        const d = o.deal!;
        let question: string;
        let was: number;
        let now: string;
        if (d.kind === "combo") {
          question = `${o.badge ? "" : "Combo: "}${(en && o.titleEn) || o.title}`;
          was = comboRegularCents(o);
          now = (en ? "only " : "μόνο ") + money(d.priceCents);
        } else {
          const name = pick(o.item!.name, o.item!.nameEn);
          question = d.kind === "addon" ? (en ? `Want ${name} with that?` : `Θέλεις και ${name};`) : (en && o.titleEn) || o.title;
          was = o.item!.priceCents;
          now = (d.kind === "addon" ? (en ? "only +" : "μόνο +") : en ? "only " : "μόνο ") + money(d.priceCents);
        }
        return (
          <div key={o.id} className="flex items-center gap-3 rounded-card border-2 border-gold bg-gold/10 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-snug">
                {o.badge && <span className="mr-2 rounded-full bg-offerDeep px-2 py-0.5 text-xs font-bold text-white">{o.badge}</span>}
                {question}
              </p>
              {d.kind === "combo" && (
                <p className="mt-0.5 text-xs text-char/60">
                  {(o.items ?? []).map((m) => pick(m.name, m.nameEn)).join(" + ")}
                </p>
              )}
              <p className="mt-0.5 text-sm">
                <s className="mr-1.5 text-stone">{money(was)}</s>
                <span className="font-bold text-offer">{now}</span>
              </p>
            </div>
            <button type="button" onClick={() => addOffer(o)} className="btn-primary shrink-0 text-sm">
              {en ? "Add" : "Πρόσθεσε"}
            </button>
          </div>
        );
      })}

      {recSuggestions.length > 0 && (
        <div className="card p-4">
          <p className="text-sm font-bold">{en ? "Goes well with your order" : "Ταιριάζει με την παραγγελία σου"}</p>
          <ul className="mt-2 divide-y divide-line">
            {recSuggestions.map((r) => {
              const name = pick(r.item.name, r.item.nameEn);
              return (
                <li key={r.id} className="flex items-center gap-3 py-2.5">
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-char/5">
                    {r.item.image && <Image src={r.item.image} alt="" fill sizes="48px" className="object-cover" />}
                  </div>
                  <p className="min-w-0 flex-1 text-sm">
                    <span className="block font-semibold leading-snug">
                      {en ? `Add ${name}?` : `Θέλεις και ${name};`}
                    </span>
                    <span className="text-char/60">+{money(r.item.priceCents)}</span>
                  </p>
                  <button type="button" onClick={() => addRec(r)} className="btn-secondary shrink-0 text-sm">
                    {en ? "Add" : "Πρόσθεσε"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
