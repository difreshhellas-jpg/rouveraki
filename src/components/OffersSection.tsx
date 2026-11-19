"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
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

  return (
    <section id="offers" aria-labelledby="offers-title" className="mx-auto max-w-content scroll-mt-24 px-4 py-6 sm:px-6">
      {offers.length > 0 && (
        <>
          <p className="eyebrow">{en ? "Right now" : "Αυτή τη στιγμή"}</p>
          <h2 id="offers-title" className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
            {en ? "Offers" : "Προσφορές"}
          </h2>
          <div className="mt-4">
            {offers.length === 1 ? <SingleOffer offer={offers[0]} /> : <OfferSlideshow offers={offers} />}
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

const SLIDE_MS = 6500;
const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** True once the element has scrolled into view (its entrance animation starts then). */
function useSeen(ref: RefObject<HTMLElement | null>) {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, seen]);
  return seen;
}

function SingleOffer({ offer }: { offer: PublicOffer }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useSeen(ref);
  return (
    <div ref={ref} className={clsx("offer-slide", seen && "offer-active")}>
      <OfferBanner offer={offer} large />
    </div>
  );
}

/**
 * Two or more offers: one large banner at a time, stacked on top of each other.
 * Changing offer morphs: the old photo closes into a point and blurs away
 * while the new one opens out of the opposite side and its words rise in. It
 * moves on by itself every few seconds (stops while the visitor points at it,
 * touches it or presses pause), can be swiped on a phone, and the photo tabs
 * underneath show which offer is which and fill up like a timer. Behind it, a
 * soft glow takes the colours of the photo on show.
 */
function OfferSlideshow({ offers }: { offers: PublicOffer[] }) {
  const { locale } = useI18n();
  const en = locale === "en";
  const wrap = useRef<HTMLDivElement>(null);
  const seen = useSeen(wrap);
  const [i, setI] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [paused, setPaused] = useState(false);
  const [hold, setHold] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [height, setHeight] = useState<number | null>(null);
  const slides = useRef<(HTMLDivElement | null)[]>([]);
  const touchX = useRef<number | null>(null);
  const n = offers.length;
  const titleOf = (o: PublicOffer) => (en && o.titleEn) || o.title;

  const go = useCallback(
    (k: number, d?: 1 | -1) => {
      const j = ((k % n) + n) % n;
      setDir(d ?? (k >= i ? 1 : -1));
      setI(j);
    },
    [n, i],
  );

  // The stage takes the height of the offer on show, so a short one leaves no empty box.
  useLayoutEffect(() => {
    const el = slides.current[i];
    if (!el) return;
    const measure = () => setHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [i]);

  const stopped = paused || hold || hidden || !seen || reducedMotion();
  useEffect(() => {
    if (stopped) return;
    const id = window.setTimeout(() => go(i + 1, 1), SLIDE_MS);
    return () => window.clearTimeout(id);
  }, [i, stopped, go]);

  // A tab in the background should not keep turning slides.
  useEffect(() => {
    const vis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", vis);
    return () => document.removeEventListener("visibilitychange", vis);
  }, []);

  const roundBtn =
    "grid size-10 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink shadow-card transition hover:border-accent hover:text-accent active:scale-95";
  const glow = offerImage(offers[i]);

  return (
    <div
      ref={wrap}
      role="region"
      aria-roledescription={en ? "carousel" : "εναλλαγή προσφορών"}
      aria-label={en ? "Offers" : "Προσφορές"}
      className={clsx("relative isolate", stopped && "offer-paused")}
      onPointerEnter={(e) => e.pointerType === "mouse" && setHold(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setHold(false)}
      onFocus={() => setHold(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setHold(false)}
    >
      {/* ambient glow in the colours of the photo on show */}
      {glow && (
        <div aria-hidden className="pointer-events-none absolute -top-8 bottom-6 -z-10 overflow-hidden [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_72%)] inset-x-0 sm:-inset-x-10">
          <Image
            key={glow}
            src={glow}
            alt=""
            fill
            sizes="200px"
            className="offer-glow scale-110 object-cover opacity-50 blur-3xl saturate-150 dark:opacity-45"
          />
        </div>
      )}

      <div
        className="offer-stage grid items-start transition-[height] duration-700 ease-out motion-reduce:transition-none"
        style={{ height: height ?? undefined, "--ox": dir === 1 ? "88%" : "12%" } as CSSProperties}
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX;
          setPaused(true);
        }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          touchX.current = null;
          if (start === null) return;
          const dx = e.changedTouches[0].clientX - start;
          if (Math.abs(dx) > 45) go(dx < 0 ? i + 1 : i - 1, dx < 0 ? 1 : -1);
        }}
      >
        {offers.map((o, k) => (
          <div
            key={o.id}
            ref={(el) => {
              slides.current[k] = el;
            }}
            role="group"
            aria-roledescription={en ? "slide" : "προσφορά"}
            aria-label={`${k + 1} / ${n}`}
            aria-hidden={k !== i}
            inert={k !== i}
            className={clsx(
              "offer-slide offer-morph flex [grid-area:1/1]",
              k === i ? "z-10" : "z-0",
              seen && k === i && "offer-active",
              k === i && "offer-current",
            )}
          >
            <OfferBanner offer={o} large />
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button type="button" onClick={() => go(i - 1, -1)} aria-label={en ? "Previous offer" : "Προηγούμενη προσφορά"} className={roundBtn}>
          <span aria-hidden className="text-xl leading-none">‹</span>
        </button>
        <ol className="flex min-w-0 flex-1 items-center justify-center gap-0.5 sm:gap-2 sm:py-1">
          {offers.map((o, k) => {
            const img = offerImage(o);
            const on = k === i;
            return (
              <li key={o.id} className="min-w-0 sm:max-w-[15rem] sm:flex-1">
                <button
                  type="button"
                  onClick={() => go(k)}
                  aria-current={on ? "true" : undefined}
                  aria-label={`${k + 1}. ${titleOf(o)}`}
                  className={clsx(
                    "relative flex items-center transition-all duration-300",
                    // phone: a dot (with a big tap area) that stretches into a timer bar
                    on ? "w-12" : "w-7",
                    "h-9 px-1.5 sm:h-auto sm:w-full sm:gap-2 sm:overflow-hidden sm:rounded-xl sm:border sm:p-1.5 sm:text-left",
                    on
                      ? "sm:-translate-y-0.5 sm:border-accent sm:bg-surface sm:shadow-accent"
                      : "sm:border-line sm:bg-surface/70 sm:opacity-80 sm:hover:-translate-y-0.5 sm:hover:opacity-100",
                  )}
                >
                  <span
                    aria-hidden
                    className={clsx("relative block h-3 w-full overflow-hidden rounded-full sm:hidden", on ? "bg-accent/25" : "bg-line")}
                  >
                    {on && (
                      <span
                        key={`${i}-${seen}`}
                        className="offer-progress block h-full rounded-full bg-accent"
                        style={{ "--dur": `${SLIDE_MS}ms` } as CSSProperties}
                      />
                    )}
                  </span>
                  <span className="relative hidden size-9 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-accent to-offer sm:block">
                    {img && <Image src={img} alt="" fill sizes="36px" className="object-cover" />}
                  </span>
                  <span className={clsx("hidden min-w-0 truncate text-xs font-semibold sm:block", on ? "text-ink" : "text-stone")}>
                    {titleOf(o)}
                  </span>
                  <span aria-hidden className="absolute inset-x-0 bottom-0 hidden h-[3px] sm:block">
                    {on && (
                      <span
                        key={`${i}-${seen}`}
                        className="offer-progress block h-full bg-accent"
                        style={{ "--dur": `${SLIDE_MS}ms` } as CSSProperties}
                      />
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-stone sm:hidden" aria-hidden>
          {i + 1}/{n}
        </span>
        <button type="button" onClick={() => go(i + 1, 1)} aria-label={en ? "Next offer" : "Επόμενη προσφορά"} className={roundBtn}>
          <span aria-hidden className="text-xl leading-none">›</span>
        </button>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? (en ? "Play" : "Συνέχεια") : en ? "Pause" : "Παύση"}
          aria-pressed={paused}
          className={roundBtn}
        >
          <span aria-hidden className="text-xs">{paused ? "▶" : "❚❚"}</span>
        </button>
      </div>
      <p className="sr-only" aria-live={stopped ? "polite" : "off"}>
        {`${i + 1} / ${n}: ${titleOf(offers[i])}`}
      </p>
    </div>
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
        "offer-card relative flex w-full overflow-hidden rounded-card border border-accent/25 bg-surface shadow-lift",
        large ? "flex-col md:flex-row" : "flex-col",
      )}
    >
      <div
        className={clsx(
          "offer-media relative shrink-0 overflow-hidden bg-gradient-to-br from-accent to-offer",
          large ? "aspect-[16/9] md:aspect-auto md:min-h-[20rem] md:w-[55%]" : "aspect-[16/9]",
        )}
      >
        {img && (
          <Image
            src={img}
            alt=""
            fill
            sizes={large ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 640px) 100vw, 33vw"}
            quality={85}
            className="offer-photo object-cover"
          />
        )}
        {/* Keeps the badge readable on any photo, light or dark theme. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-black/25" />
        {o.badge && (
          <span
            style={{ "--d": "250ms" } as CSSProperties}
            className={clsx(
              "offer-pop absolute left-3 top-3 rounded-full bg-offerDeep font-bold text-white shadow-lift",
              large ? "px-4 py-1.5 text-lg" : "px-3 py-1 text-sm",
            )}
          >
            {o.badge}
          </span>
        )}
        {now && (
          <span
            style={{ "--d": "450ms" } as CSSProperties}
            className="offer-pop absolute bottom-3 right-3 rounded-2xl bg-surface/90 px-3.5 py-2 text-right leading-tight text-ink shadow-lift ring-1 ring-offer/40 backdrop-blur-md">
            {was !== null && <s className="block text-xs text-stone">{money(was)}</s>}
            <span className={clsx("font-display font-bold text-offer", large ? "text-2xl md:text-3xl" : "text-xl")}>{now}</span>
          </span>
        )}
      </div>

      <div className={clsx("flex flex-1 flex-col", large ? "p-5 md:p-8" : "p-4")}>
        {d?.kind === "combo" && <p className="offer-rise eyebrow">Combo</p>}
        <h3 style={{ "--d": "80ms" } as CSSProperties} className={clsx("offer-rise font-display font-semibold leading-tight", large ? "text-2xl md:text-4xl" : "text-xl")}>
          {title}
        </h3>
        {d?.kind === "combo" && o.items && (
          <p style={{ "--d": "160ms" } as CSSProperties} className="offer-rise mt-1 text-sm font-semibold text-char/70">
            {o.items.map((m) => pick(m.name, m.nameEn)).join(" + ")}
          </p>
        )}
        {d?.kind === "addon" && o.item && (
          <p className="mt-1 text-sm font-semibold text-char/70">
            {en ? "With your order: " : "Με την παραγγελία σου: "}
            {pick(o.item.name, o.item.nameEn)}
          </p>
        )}
        {body && <p style={{ "--d": "220ms" } as CSSProperties} className="offer-rise mt-2 whitespace-pre-line text-sm text-stone">{body}</p>}
        <div style={{ "--d": "320ms" } as CSSProperties} className="offer-rise mt-auto flex flex-wrap items-center gap-3 pt-4">
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
        on ? "border-success/50 bg-success/10" : "border-gold bg-gold/10",
      )}
    >
      <div
        aria-hidden
        className={clsx(
          "grid size-14 shrink-0 place-items-center rounded-full text-2xl",
          on ? "bg-success text-white" : "bg-rust text-onrust",
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
