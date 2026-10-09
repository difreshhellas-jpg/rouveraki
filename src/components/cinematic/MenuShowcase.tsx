"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/LanguageProvider";
import { CATEGORIES } from "@/lib/brand";
import { categoryPhoto } from "@/lib/images";
import Reveal from "../Reveal";

/**
 * Category list where hovering a row swaps a large photo beside it.
 *
 * This sits on the homepage as a way in; it does not replace /menu, which is
 * the working ordering screen. A hover-preview gallery is a lovely way to
 * browse and a poor way to order, so each row links into the real menu at its
 * own anchor.
 *
 * Keyboard and touch both get the same behaviour as hover: rows are links,
 * focus swaps the preview exactly as hover does, and on touch the active row
 * follows whichever was last touched. Nothing here is hover-only.
 *
 * Every preview image is rendered and stacked, with opacity switching between
 * them, so a swap never waits on a network request mid-interaction.
 */
export default function MenuShowcase() {
  const { t, pick, locale } = useI18n();
  const [active, setActive] = useState(0);

  return (
    <section className="mx-auto max-w-content px-4 py-20 sm:px-6 sm:py-28">
      <Reveal as="header" className="max-w-2xl">
        <p className="eyebrow">{locale === "en" ? "The menu" : "Το μενού"}</p>
        <h2 className="mt-3 font-display text-[clamp(1.9rem,5vw,3rem)] font-semibold leading-tight">
          {locale === "en" ? "Twelve reasons to stop by" : "Δώδεκα λόγοι να περάσεις"}
        </h2>
        <div className="tex-rope mt-6 w-24" />
      </Reveal>

      <div className="mt-12 grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:items-start">
        {/* ---- rows ------------------------------------------------------ */}
        <ul className="border-t border-line">
          {CATEGORIES.map((c, i) => (
            <li key={c.slug} className="border-b border-line">
              <Link
                href={`/menu#${c.slug}`}
                data-active={i === active ? "" : undefined}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onTouchStart={() => setActive(i)}
                className="showcase-row group flex items-center justify-between gap-4 py-4 sm:py-5"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="showcase-rule hidden h-px w-8 shrink-0 bg-accent sm:block"
                  />
                  <span className="font-display text-[clamp(1.35rem,3.4vw,2.1rem)] font-medium leading-none tracking-[-0.015em]">
                    {pick(c.el, c.en)}
                  </span>
                </span>
                <ArrowUpRight
                  size={20}
                  weight="bold"
                  aria-hidden="true"
                  className="shrink-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
                />
              </Link>
            </li>
          ))}
        </ul>

        {/* ---- preview --------------------------------------------------- */}
        {/* Sticky so the photo stays beside the row being read on a long list. */}
        <div className="showcase-preview relative hidden aspect-[4/5] overflow-hidden rounded-card border border-line shadow-card lg:sticky lg:top-28 lg:block">
          {CATEGORIES.map((c, i) => (
            <Image
              key={c.slug}
              src={categoryPhoto(c.slug, 900, 1100)}
              alt=""
              fill
              sizes="(max-width: 1024px) 0px, 40vw"
              className="object-cover"
              style={{
                opacity: i === active ? 1 : 0,
                transform: i === active ? "scale(1)" : "scale(1.04)",
              }}
            />
          ))}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"
          />
          <p className="absolute bottom-5 left-6 font-display text-2xl font-semibold text-white">
            {pick(CATEGORIES[active].el, CATEGORIES[active].en)}
          </p>
        </div>
      </div>

      <Reveal className="mt-10">
        <Link href="/menu" className="btn-primary px-8">
          {t("hero.cta")}
        </Link>
      </Reveal>
    </section>
  );
}
