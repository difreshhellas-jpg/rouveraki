"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/i18n/LanguageProvider";
import { pushState, turnOffOfferPush, turnOnOfferPush, useOffers, type PushState } from "@/lib/use-offers";
import { formatEuro } from "@/lib/money";
import { dealLine } from "@/lib/offer-cart";
import { useCart } from "@/store/cart";
import { useToast } from "./Toaster";

/**
 * The owner's current offers (set from the shop app), with a button to get
 * them as phone notifications. Renders nothing while there are no offers.
 */
export default function OffersSection({ showMenuLink = false }: { showMenuLink?: boolean }) {
  const data = useOffers();
  const { locale } = useI18n();
  const en = locale === "en";
  const [push, setPush] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const addLine = useCart((s) => s.addLine);
  const { toast } = useToast();
  const money = (c: number) => formatEuro(c / 100, en ? "en-IE" : "el-GR");

  useEffect(() => {
    if (data?.pushKey) void pushState().then(setPush);
  }, [data?.pushKey]);

  if (!data || data.offers.length === 0) return null;

  const toggle = async () => {
    if (!data.pushKey || busy) return;
    setBusy(true);
    try {
      setPush(push === "on" ? await turnOffOfferPush() : await turnOnOfferPush(data.pushKey));
    } catch {
      setPush("off");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="offers" aria-labelledby="offers-title" className="mx-auto max-w-content scroll-mt-24 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <p className="eyebrow">{en ? "Right now" : "Αυτή τη στιγμή"}</p>
          <h2 id="offers-title" className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
            {en ? "Offers" : "Προσφορές"}
          </h2>
        </div>
        {data.pushKey && push && push !== "unsupported" && (
          <div className="ml-auto text-right">
            {push === "ios-install" ? (
              <p className="max-w-xs text-xs text-stone">
                {en
                  ? "To get offer alerts on iPhone, first add the site to your Home Screen."
                  : "Για ειδοποιήσεις προσφορών στο iPhone, πρόσθεσε πρώτα το site στην οθόνη Αφετηρίας."}
              </p>
            ) : push === "denied" ? (
              <p className="max-w-xs text-xs text-stone">
                {en
                  ? "Notifications are blocked for this site in your browser settings."
                  : "Οι ειδοποιήσεις είναι μπλοκαρισμένες για το site στις ρυθμίσεις του browser."}
              </p>
            ) : (
              <button
                type="button"
                onClick={toggle}
                disabled={busy}
                className={push === "on" ? "btn-secondary text-sm" : "btn-primary text-sm"}
              >
                {push === "on"
                  ? en
                    ? "🔕 Stop offer alerts"
                    : "🔕 Διακοπή ειδοποιήσεων"
                  : en
                    ? "🔔 Get offer alerts"
                    : "🔔 Ειδοποιήσεις για προσφορές"}
              </button>
            )}
          </div>
        )}
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.offers.map((o) => {
          const title = (en && o.titleEn) || o.title;
          const body = (en && o.textEn) || o.text;
          return (
            <li key={o.id} className="card relative overflow-hidden border-2 border-gold/60 p-5">
              {o.badge && (
                <span className="mb-2 inline-block rounded-full bg-rust px-3 py-1 text-sm font-bold text-onrust">
                  {o.badge}
                </span>
              )}
              <h3 className="font-display text-xl font-semibold">{title}</h3>
              {body && <p className="mt-1 whitespace-pre-line text-sm text-stone">{body}</p>}
              {o.deal && o.item && (
                <div className="mt-3">
                  <p className="text-sm">
                    {o.deal.kind === "addon" && (
                      <span className="mr-1">
                        {en ? "With your order:" : "Με την παραγγελία σου:"}{" "}
                        <strong>{(en && o.item.nameEn) || o.item.name}</strong>
                      </span>
                    )}
                    <s className="mr-1.5 text-char/45">{money(o.item.priceCents)}</s>
                    <span className="font-display text-lg font-bold text-rust">
                      {o.deal.kind === "addon" ? "+" : ""}
                      {money(o.deal.priceCents)}
                    </span>
                  </p>
                  {o.deal.kind === "item" ? (
                    o.item.available && (
                      <button
                        type="button"
                        className="btn-primary mt-2 text-sm"
                        onClick={() => {
                          const line = dealLine(o);
                          if (!line) return;
                          addLine(line);
                          toast((en && line.nameEn) || line.name, { variant: "success" });
                        }}
                      >
                        {en ? "Add to cart" : "Πρόσθεσε στο καλάθι"}
                      </button>
                    )
                  ) : (
                    <p className="mt-1 text-xs text-char/60">
                      {en ? "We will offer it at checkout." : "Θα σου το προτείνουμε στο ταμείο."}
                    </p>
                  )}
                </div>
              )}
              {o.endsOn && (
                <p className="mt-2 text-xs font-semibold text-char/60">
                  {en ? "Until " : "Έως "}
                  {o.endsOn.split("-").reverse().join("/")}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {showMenuLink && (
        <Link href="/menu" className="btn-primary mt-4 inline-flex text-sm">
          {en ? "Order now" : "Παράγγειλε τώρα"}
        </Link>
      )}
    </section>
  );
}
