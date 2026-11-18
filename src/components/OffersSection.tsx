"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";
import { useI18n } from "@/i18n/LanguageProvider";
import { formatEuro } from "@/lib/money";
import { comboRegularCents, dealLines } from "@/lib/offer-cart";
import { offerImage, type PublicOffer } from "@/lib/offer-types";
import { pushState, turnOffOfferPush, turnOnOfferPush, useOffers, type PushState } from "@/lib/use-offers";
import { useCart } from "@/store/cart";
import { useToast } from "./Toaster";

/**
 * The owner's current offers (set from the shop app) as photo banners: the
 * first one large, the rest as cards. Below them, the box to get offers as
 * phone notifications (shown whenever notifications are set up, even with no
 * offers running). Renders nothing when there is neither.
 */
export default function OffersSection({ showMenuLink = false }: { showMenuLink?: boolean }) {
  const data = useOffers();
  const { locale } = useI18n();
  const en = locale === "en";
  if (!data) return null;
  const { offers, pushKey } = data;
  if (offers.length === 0 && !pushKey) return null;
  const [first, ...rest] = offers;

  return (
    <section id="offers" aria-labelledby="offers-title" className="mx-auto max-w-content scroll-mt-24 px-4 py-6 sm:px-6">
      {offers.length > 0 && (
        <>
          <p className="eyebrow">{en ? "Right now" : "Αυτή τη στιγμή"}</p>
          <h2 id="offers-title" className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
            {en ? "Offers" : "Προσφορές"}
          </h2>
          <div className="mt-4 space-y-4">
            <OfferBanner offer={first} large />
            {rest.length > 0 && (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((o) => (
                  <li key={o.id} className="flex">
                    <OfferBanner offer={o} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          {showMenuLink && (
            <Link href="/menu" className="btn-primary mt-4 inline-flex text-sm">
              {en ? "Order now" : "Παράγγειλε τώρα"}
            </Link>
          )}
        </>
      )}
      {offers.length === 0 && (
        <h2 id="offers-title" className="sr-only">
          {en ? "Offers" : "Προσφορές"}
        </h2>
      )}
      {pushKey && <OfferAlertsBox pushKey={pushKey} />}
    </section>
  );
}

/** One offer: photo with the badge on it, then title, text, price and button. */
function OfferBanner({ offer: o, large = false }: { offer: PublicOffer; large?: boolean }) {
  const { locale, pick } = useI18n();
  const en = locale === "en";
  const addLine = useCart((s) => s.addLine);
  const { toast } = useToast();
  const money = (c: number) => formatEuro(c / 100, en ? "en-IE" : "el-GR");
  const title = (en && o.titleEn) || o.title;
  const body = (en && o.textEn) || o.text;
  const img = offerImage(o);
  const d = o.deal;
  const lines = dealLines(o);

  const add = () => {
    if (lines.length === 0) return;
    lines.forEach((l) => addLine(l));
    toast(title, { variant: "success" });
  };

  let was: number | null = null;
  let now: string | null = null;
  if (d?.kind === "combo") {
    was = comboRegularCents(o);
    now = money(d.priceCents);
  } else if (d && o.item) {
    was = o.item.priceCents;
    now = (d.kind === "addon" ? "+" : "") + money(d.priceCents);
  }

  return (
    <article
      className={clsx(
        "flex w-full overflow-hidden rounded-card border border-line bg-surface shadow-lift",
        large ? "flex-col md:flex-row" : "flex-col",
      )}
    >
      <div
        className={clsx(
          "relative shrink-0 overflow-hidden bg-gradient-to-br from-gold to-rust",
          large ? "aspect-[16/9] md:aspect-auto md:min-h-[18rem] md:w-1/2" : "aspect-[16/9]",
        )}
      >
        {img && (
          <Image
            src={img}
            alt=""
            fill
            sizes={large ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 640px) 100vw, 33vw"}
            className="object-cover"
          />
        )}
        {/* Keeps the badge readable on any photo, light or dark theme. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        {o.badge && (
          <span
            className={clsx(
              "absolute left-3 top-3 rounded-full bg-rust font-bold text-onrust shadow-lift",
              large ? "px-4 py-1.5 text-lg" : "px-3 py-1 text-sm",
            )}
          >
            {o.badge}
          </span>
        )}
        {now && (
          <span className="absolute bottom-3 right-3 rounded-2xl bg-surface/95 px-3 py-1.5 text-right leading-tight text-char shadow-lift">
            {was !== null && <s className="block text-xs text-char/50">{money(was)}</s>}
            <span className={clsx("font-display font-bold text-rust", large ? "text-2xl" : "text-xl")}>{now}</span>
          </span>
        )}
      </div>

      <div className={clsx("flex flex-1 flex-col", large ? "p-5 md:p-8" : "p-4")}>
        {d?.kind === "combo" && <p className="eyebrow">Combo</p>}
        <h3 className={clsx("font-display font-semibold leading-tight", large ? "text-2xl md:text-3xl" : "text-xl")}>
          {title}
        </h3>
        {d?.kind === "combo" && o.items && (
          <p className="mt-1 text-sm font-semibold text-char/70">
            {o.items.map((m) => pick(m.name, m.nameEn)).join(" + ")}
          </p>
        )}
        {d?.kind === "addon" && o.item && (
          <p className="mt-1 text-sm font-semibold text-char/70">
            {en ? "With your order: " : "Με την παραγγελία σου: "}
            {pick(o.item.name, o.item.nameEn)}
          </p>
        )}
        {body && <p className="mt-2 whitespace-pre-line text-sm text-stone">{body}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
          {d && d.kind !== "addon" && lines.length > 0 && (
            <button type="button" onClick={add} className="btn-primary text-sm">
              {en ? "Add to cart" : "Πρόσθεσε στο καλάθι"}
            </button>
          )}
          {d?.kind === "addon" && (
            <p className="text-xs text-char/60">
              {en ? "We will offer it at checkout." : "Θα σου το προτείνουμε στο ταμείο."}
            </p>
          )}
          {o.endsOn && (
            <p className="text-xs font-semibold text-char/60">
              {en ? "Until " : "Έως "}
              {o.endsOn.split("-").reverse().join("/")}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

/** Sign up for offers as phone notifications. */
function OfferAlertsBox({ pushKey }: { pushKey: string }) {
  const { locale } = useI18n();
  const en = locale === "en";
  const [push, setPush] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => void pushState().then(setPush), []);
  if (!push || push === "unsupported") return null;

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      setPush(push === "on" ? await turnOffOfferPush() : await turnOnOfferPush(pushKey));
    } catch {
      setPush("off");
    } finally {
      setBusy(false);
    }
  };

  const on = push === "on";
  return (
    <div
      className={clsx(
        "mt-6 flex flex-col gap-4 rounded-card border-2 p-5 sm:flex-row sm:items-center sm:p-6",
        on ? "border-emerald-600/40 bg-emerald-600/10" : "border-gold bg-gold/10",
      )}
    >
      <div
        aria-hidden
        className={clsx(
          "grid size-14 shrink-0 place-items-center rounded-full text-2xl",
          on ? "bg-emerald-600 text-white" : "bg-rust text-onrust",
        )}
      >
        {on ? "✓" : "🔔"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-xl font-semibold">
          {on
            ? en
              ? "You will hear about our offers first"
              : "Θα μαθαίνεις πρώτος τις προσφορές μας"
            : en
              ? "Be the first to hear about our offers"
              : "Μάθε πρώτος τις προσφορές μας"}
        </p>
        <p className="mt-1 text-sm text-stone">
          {push === "ios-install"
            ? en
              ? "On iPhone: tap Share, then Add to Home Screen, and open the site from there to turn this on."
              : "Στο iPhone: πάτα Κοινοποίηση → Προσθήκη στην οθόνη Αφετηρίας και άνοιξε το site από εκεί για να το ενεργοποιήσεις."
            : push === "denied"
              ? en
                ? "Notifications are blocked for this site. Allow them in your browser settings."
                : "Οι ειδοποιήσεις είναι μπλοκαρισμένες για το site. Επίτρεψέ τες από τις ρυθμίσεις του browser."
              : en
                ? "One notification on your phone when a new offer starts. No spam; stop any time."
                : "Μία ειδοποίηση στο κινητό σου όταν ξεκινά νέα προσφορά. Χωρίς spam, το σταματάς όποτε θες."}
        </p>
      </div>
      {(push === "on" || push === "off") && (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className={clsx("shrink-0", on ? "btn-secondary text-sm" : "btn-primary")}
        >
          {on ? (en ? "Turn off" : "Απενεργοποίηση") : en ? "🔔 Notify me" : "🔔 Θέλω ειδοποιήσεις"}
        </button>
      )}
    </div>
  );
}
