"use client";

import Link from "next/link";
import Image from "next/image";
import { photo, SITE } from "@/lib/images";
import { useI18n } from "@/i18n/LanguageProvider";
import Reveal from "./Reveal";
import Tilt from "./Tilt";

/**
 * Three cards saying "we are a café, a grill house and an evening spot" without any live
 * clock logic. Each links straight to the first menu category of its daypart,
 * so the storytelling and the navigation are the same click.
 */
/** Each card leads with a verified photo of what that part of the day is. */
const DAYPARTS = [
  { id: "morning", photo: SITE.dayMorning, icon: CupIcon, slug: "kafedes" },
  { id: "grill", photo: SITE.dayGrill, icon: FlameIcon, slug: "pites" },
  { id: "evening", photo: SITE.dayEvening, icon: MoonIcon, slug: "orektika" },
] as const;

export default function DaypartStrip() {
  const { t } = useI18n();

  return (
    <section
      id="daypart"
      className="mx-auto max-w-content scroll-mt-28 px-4 py-20 sm:px-6 sm:py-28"
    >
      <Reveal as="header" className="max-w-2xl">
        <h2 className="font-display text-[clamp(1.9rem,5vw,3rem)] font-bold leading-tight">
          {t("daypart.title")}
        </h2>
        <p className="mt-3 text-lg text-char/70">{t("daypart.lead")}</p>
        <div className="tex-rope mt-6 w-24" />
      </Reveal>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {DAYPARTS.map((d, i) => {
          const Icon = d.icon;
          return (
            <Reveal key={d.id} delayMs={i * 60}>
              <Tilt className="h-full rounded-card">
              <Link
                href={`/menu#${d.slug}`}
                className="group card card-tappable flex h-full flex-col overflow-hidden"
              >
                {/* Photo banner with a bottom scrim so the icon stays legible.
                    The image scales slightly on hover; the card itself tilts. */}
                <div className="img-zoom relative h-44" aria-hidden="true">
                  <Image
                    src={photo(d.photo, 900, 600)}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-4 left-5 text-white drop-shadow">
                    <Icon />
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="font-display text-xl font-semibold">
                    {t(`daypart.${d.id}.title` as never)}
                  </h3>
                  <p className="mt-2 flex-1 text-char/70">
                    {t(`daypart.${d.id}.body` as never)}
                  </p>
                  {/* A real button look, so each card reads as something to tap. */}
                  <span className="btn-primary mt-5 w-full gap-2">
                    {t(`daypart.${d.id}.cta` as never)}
                    <span
                      aria-hidden="true"
                      className="transition-transform duration-150 motion-safe:group-hover:translate-x-1"
                    >
                      &rarr;
                    </span>
                  </span>
                </div>
              </Link>
              </Tilt>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

function CupIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 8h1a3 3 0 1 1 0 6h-1M3 8h14v6a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8zM6 2v2M10 2v2M14 2v2" />
    </svg>
  );
}

function FlameIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2s4 4.5 4 8a4 4 0 0 1-8 0c0-1.2.5-2.3 1-3M12 22a7 7 0 0 0 7-7c0-2-1-4-2.5-5.5" />
      <path d="M12 22a7 7 0 0 1-7-7c0-2 1-4 2.5-5.5" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
