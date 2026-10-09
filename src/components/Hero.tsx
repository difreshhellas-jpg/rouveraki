"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/LanguageProvider";
import { HERO_PHOTOS, HERO_FALLBACK_GRADIENTS } from "@/lib/photos";
import { isShopOpen } from "@/lib/hours";
import { BRAND } from "@/lib/brand";
import ScrollCue from "./motion/ScrollCue";
import { useRipple } from "./motion/useRipple";

/**
 * Full-bleed hero.
 *
 * Load sequence, deliberately ordered so the eye lands in the right place:
 *   0ms    photo + scrim (already painted, it is the LCP element)
 *   150ms  status line
 *   260ms  headline, word by word
 *   900ms  subhead, then the CTAs
 *
 * The crossfade is one CSS keyframe per layer, generated from the slide count
 * so adding a photo cannot desynchronise it, with a slow Ken Burns drift on
 * each slide. No scroll-jacking and no parallax on the hero itself: the photo
 * is the first thing a hungry person sees and it should just be there.
 */
export default function Hero() {
  const { t, locale, pick } = useI18n();
  const ripple = useRipple();

  // The open/closed pill reads the clock, which differs between the server
  // render and the client. Compute after mount so hydration cannot mismatch.
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    setOpen(isShopOpen());
    const id = setInterval(() => setOpen(isShopOpen()), 60_000);
    return () => clearInterval(id);
  }, []);

  const slides = HERO_PHOTOS.length ? HERO_PHOTOS : null;
  const layerCount = slides?.length ?? HERO_FALLBACK_GRADIENTS.length;

  const HOLD = 6;
  const FADE = 1.2;
  const cycle = layerCount * HOLD;
  const pct = (seconds: number) => ((seconds / cycle) * 100).toFixed(3);
  const keyframes = `@keyframes hero-cross-${layerCount}{
    0%,${pct(HOLD - FADE)}%{opacity:1}
    ${pct(HOLD)}%,${pct(cycle - FADE)}%{opacity:0}
    100%{opacity:1}
  }`;

  return (
    // zoom-blur-hero (luxury-web-animations): the media zooms out, blurs and
    // darkens as you leave while the next section slides over the pinned hero.
    <section data-fx="zoom-blur-hero" data-blur="12" className="fx-hero isolate">
      <style dangerouslySetInnerHTML={{ __html: keyframes }} />

      <div className="fx-hero__media">
        {Array.from({ length: layerCount }).map((_, i) => (
          <div
            key={i}
            data-hero-slide=""
            className="absolute inset-0"
            style={{
              animation: `hero-cross-${layerCount} ${cycle}s linear infinite`,
              animationDelay: `${-(layerCount - i) * HOLD}s`,
              opacity: i === 0 ? 1 : 0,
              ...(slides
                ? {}
                : { backgroundImage: HERO_FALLBACK_GRADIENTS[i % HERO_FALLBACK_GRADIENTS.length] }),
            }}
          >
            {slides && (
              <Image
                src={slides[i].src}
                alt={pick(slides[i].alt, slides[i].altEn)}
                fill
                priority={i === 0}
                sizes="100vw"
                className="object-cover"
              />
            )}
          </div>
        ))}
        {/* Legibility scrim travels with the photo, so the copy stays readable at every frame. */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.78) 26%, rgba(0,0,0,0.42) 52%, rgba(0,0,0,0.18) 100%)",
          }}
        />
      </div>
      <div className="fx-hero__shade" aria-hidden="true" />

      {/* wire-3d (Three.js): line-art icosahedron reacting to pointer and scroll. */}
      <div data-fx="wire-3d" data-color="#e0b458" data-shape="ico" className="fx-wire" aria-hidden="true">
        <canvas className="fx-webgl" />
      </div>

      <ScrollCue />

      {/* ---- copy ------------------------------------------------------- */}
      <div className="fx-hero__content">
      <div
        className="relative mx-auto w-full max-w-content px-4 pb-16 pt-32 text-white sm:px-6"
        style={{ paddingBottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <p
          className="eyebrow fade-up flex items-center gap-2.5 !text-white/80"
          style={{ ["--d" as string]: "150ms" }}
        >
          {open !== null && (
            <>
              <span
                className={`relative inline-flex size-2 rounded-full ${open ? "bg-emerald-400" : "bg-white/50"}`}
              >
                {open && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-emerald-400 motion-safe:animate-pulse-ring"
                  />
                )}
              </span>
              {open ? t("hero.openNow") : t("hero.closedNow")}
              <span className="opacity-55">{BRAND.address.city}</span>
            </>
          )}
        </p>

        {/* The wordmark is the headline. Word-by-word on a two-word Greek name
            reads as deliberate; on the English it is one word, so it gets the
            same treatment and simply resolves faster. */}
        <h1
          data-fx="masked-headline"
          data-split="chars"
          data-delay="0.25"
          className="mt-5 font-display text-[clamp(3rem,11vw,7.5rem)] font-semibold leading-[0.92] tracking-[-0.03em] drop-shadow-[0_2px_24px_rgba(0,0,0,0.45)]"
        >
          {locale === "en" ? BRAND.nameEn : BRAND.nameEl}
        </h1>

        <div
          className="tex-rope fade-up mt-6 w-32 origin-left"
          style={{ ["--d" as string]: "620ms" }}
        />

        <p
          className="fade-up mt-6 max-w-xl text-lg leading-relaxed text-white/85 sm:text-xl"
          style={{ ["--d" as string]: "900ms" }}
        >
          {t("hero.subtitle")}
        </p>

        <div
          className="fade-up mt-9 flex flex-wrap items-center gap-3"
          style={{ ["--d" as string]: "1040ms" }}
        >
          {/* Primary CTA: lift + ripple, no magnetic pull. The hero stays calm;
              the magnetic treatment lives on the persistent header button. */}
          <Link
            href="/menu"
            data-fx="magnetic"
            data-strength="0.3"
            onClick={ripple}
            className="btn-primary ripple-host btn-lift group px-8 text-base"
          >
            {t("hero.cta")}
            <ArrowRight
              size={18}
              weight="bold"
              className="transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-safe:group-hover:translate-x-1"
            />
          </Link>
          <a href="#daypart" onClick={ripple} className="btn-glass ripple-host px-7 text-base">
            {t("hero.secondaryCta")}
          </a>
        </div>
      </div>
      </div>
    </section>
  );
}
