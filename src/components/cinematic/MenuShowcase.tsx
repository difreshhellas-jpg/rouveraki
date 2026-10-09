"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/LanguageProvider";
import { CATEGORIES } from "@/lib/brand";
import { categoryPhoto } from "@/lib/images";

/**
 * The twelve categories on the luxury-web-animations `hover-follow` effect: a
 * floating photo follows the pointer, tilts with its velocity, and clip-wipes
 * to the next dish as you move between rows. On touch the floating frame is
 * hidden by navigation.css and each row shows its own thumbnail instead, so
 * nothing depends on hover. Every row is a real link into /menu: a
 * hover-preview list is a lovely way to browse and a poor way to order.
 */
export default function MenuShowcase() {
  const { t, pick, locale } = useI18n();

  return (
    <section className="mx-auto max-w-content px-4 py-20 sm:px-6 sm:py-28">
      <header className="max-w-2xl">
        <p className="eyebrow">{locale === "en" ? "The menu" : "Το μενού"}</p>
        <h2
          data-fx="split-reveal"
          className="mt-3 font-display text-[clamp(1.9rem,5vw,3rem)] font-semibold leading-tight"
        >
          {locale === "en" ? "Twelve reasons to stop by" : "Δώδεκα λόγοι να περάσεις"}
        </h2>
        <div className="tex-rope mt-6 w-24" />
      </header>

      <div data-fx="hover-follow" className="relative mt-12">
        <ul className="fx-follow-list">
          {CATEGORIES.map((c) => (
            <li key={c.slug} data-img={categoryPhoto(c.slug, 600, 750)}>
              {/* eslint-disable-next-line @next/next/no-img-element -- touch thumbnail, swapped for the floating frame on desktop */}
              <img className="fx-row__thumb" src={categoryPhoto(c.slug, 160, 160)} alt="" loading="lazy" />
              <Link
                href={`/menu#${c.slug}`}
                className="fx-row__name font-display font-medium leading-none after:absolute after:inset-0"
              >
                {pick(c.el, c.en)}
              </Link>
              <span className="fx-row__price eyebrow">{locale === "en" ? c.el : c.en}</span>
            </li>
          ))}
        </ul>
        <div className="fx-follow" aria-hidden="true">
          <div className="fx-follow__frame" />
        </div>
      </div>

      <div className="mt-10">
        <Link href="/menu" data-fx="magnetic" className="btn-primary px-8">
          {t("hero.cta")}
        </Link>
      </div>
    </section>
  );
}
