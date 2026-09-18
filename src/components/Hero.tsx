"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/LanguageProvider";
import { HERO_PHOTOS, HERO_FALLBACK_GRADIENTS } from "@/lib/photos";
import { isShopOpen } from "@/lib/hours";
import { BRAND } from "@/lib/brand";

/**
 * Full-viewport hero with a slow CSS crossfade over 2–3 photos.
 *
 * Deliberately no JavaScript slideshow, no parallax and no scroll-jacking: the
 * animation is one keyframe per layer, identical on desktop and mobile, and it
 * stops entirely under prefers-reduced-motion (handled in globals.css).
 */
export default function Hero() {
  const { t, locale, pick } = useI18n();

  // The open/closed pill depends on the clock, which differs between the server
  // render and the client. Compute it after mount so hydration cannot mismatch.
  const [open, setOpen] = useState<boolean | null>(null);
  useEffect(() => {
    setOpen(isShopOpen());
    const id = setInterval(() => setOpen(isShopOpen()), 60_000);
    return () => clearInterval(id);
  }, []);

  const slides = HERO_PHOTOS.length ? HERO_PHOTOS : null;
  const layerCount = slides?.length ?? HERO_FALLBACK_GRADIENTS.length;

  /**
   * Each slide holds for HOLD seconds, so the full cycle is layerCount * HOLD.
   * The keyframes are generated from the slide count rather than hardcoded,
   * because dropping in 2 photos instead of 3 must not desynchronise the fade.
   */
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
    <section className="relative isolate flex min-h-[100svh] items-end overflow-hidden [contain:paint]">
      <style dangerouslySetInnerHTML={{ __html: keyframes }} />

      {/* --- image / gradient layers ------------------------------------ */}
      <div className="absolute inset-0 -z-20">
        {Array.from({ length: layerCount }).map((_, i) => (
          <div
            key={i}
            data-hero-slide=""
            className="absolute inset-0"
            style={{
              // One shared cycle; each layer is offset by one hold, so exactly
              // one layer is at full opacity at any moment.
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
                // The hero is the LCP element; it must not be lazy.
                priority={i === 0}
                sizes="100vw"
                className="object-cover"
              />
            )}
          </div>
        ))}
      </div>

      {/* --- legibility scrim ------------------------------------------- */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/35 to-black/25"
      />

      {/* --- copy -------------------------------------------------------- */}
      <div
        className="relative mx-auto w-full max-w-content px-4 pb-16 pt-32 text-white sm:px-6 sm:pb-24"
        style={{ paddingBottom: "calc(4rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <p className="eyebrow flex items-center gap-2 !text-white/85">
          {open !== null && (
            <>
              <span
                className={`relative inline-flex size-2.5 rounded-full ${open ? "bg-emerald-400" : "bg-white/50"}`}
              >
                {open && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full bg-emerald-400 motion-safe:animate-pulse-ring"
                  />
                )}
              </span>
              {open ? t("hero.openNow") : t("hero.closedNow")}
              <span className="opacity-60">· 06:00-01:00</span>
            </>
          )}
        </p>

        <h1 className="mt-4 font-display text-[clamp(2.75rem,10vw,6rem)] font-bold leading-[0.95] tracking-tight drop-shadow-sm">
          {locale === "en" ? BRAND.nameEn : BRAND.nameEl}
        </h1>

        <div className="tex-rope mt-6 w-28 opacity-90" />

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/90 sm:text-xl">
          {t("hero.subtitle")}
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link href="/menu" className="btn-primary px-8 text-base">
            {t("hero.cta")}
          </Link>
          <a href="#daypart" className="btn-glass px-7 text-base">
            {t("hero.secondaryCta")}
          </a>
        </div>
      </div>
    </section>
  );
}
