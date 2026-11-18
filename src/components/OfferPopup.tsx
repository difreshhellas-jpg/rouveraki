"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/LanguageProvider";
import { useOffers } from "@/lib/use-offers";
import type { Offer } from "@/lib/offer-types";

/**
 * A small card announcing an offer the visitor has not seen yet. Each offer
 * shows once per device; closing it or opening it marks it seen.
 */
const SEEN = "rouveraki.offers-seen";
/**
 * Home page only, and only once the visitor scrolls past the hero: it must
 * never sit on the hero's buttons or the menu's + buttons (the menu lists the
 * offers at its top anyway).
 */
const SHOW_ON = "/";

const readSeen = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(SEEN) ?? "[]") as string[];
  } catch {
    return [];
  }
};
const markSeen = (id: string) => {
  try {
    localStorage.setItem(SEEN, JSON.stringify([...readSeen().slice(-50), id]));
  } catch {
    /* private mode: it may show again next visit */
  }
};

export default function OfferPopup() {
  const pathname = usePathname() ?? "/";
  const skip = pathname !== SHOW_ON;
  const data = useOffers();
  const { locale } = useI18n();
  const en = locale === "en";
  const [offer, setOffer] = useState<Offer | null>(null);

  useEffect(() => {
    if (skip || !data) return;
    const seen = readSeen();
    const next = data.offers.find((o) => !seen.includes(o.id));
    if (!next) return;
    const onScroll = () => {
      if (window.scrollY < window.innerHeight * 0.8) return;
      setOffer(next);
      window.removeEventListener("scroll", onScroll);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [data, skip]);

  if (skip || !offer) return null;
  const close = () => {
    markSeen(offer.id);
    setOffer(null);
  };
  const title = (en && offer.titleEn) || offer.title;
  const body = (en && offer.textEn) || offer.text;

  return (
    <aside
      aria-label={en ? "New offer" : "Νέα προσφορά"}
      className="fixed inset-x-3 bottom-24 z-30 mx-auto max-w-sm rounded-card border-2 border-gold bg-surface p-4 shadow-lift sm:bottom-6 sm:left-auto sm:right-6 sm:mx-0"
    >
      <button
        type="button"
        onClick={close}
        aria-label={en ? "Close" : "Κλείσιμο"}
        className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full text-lg text-char/60 hover:bg-char/5"
      >
        ×
      </button>
      <p className="eyebrow">{en ? "New offer" : "Νέα προσφορά"}</p>
      <p className="mt-1 pr-8 font-display text-lg font-semibold">
        {offer.badge && <span className="mr-2 rounded-full bg-rust px-2 py-0.5 text-sm text-onrust">{offer.badge}</span>}
        {title}
      </p>
      {body && <p className="mt-1 line-clamp-3 text-sm text-stone">{body}</p>}
      <Link href="/menu#offers" onClick={close} className="btn-primary mt-3 inline-flex text-sm">
        {en ? "See the offer" : "Δες την προσφορά"}
      </Link>
    </aside>
  );
}
