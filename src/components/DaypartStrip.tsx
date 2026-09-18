"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/LanguageProvider";
import { CATEGORIES } from "@/lib/brand";
import Reveal from "./Reveal";

/**
 * Three cards saying "we are a café, a grill house and a bar" without any live
 * clock logic. Each links straight to the first menu category of its daypart,
 * so the storytelling and the navigation are the same click.
 */
const DAYPARTS = [
  { id: "morning", accent: "from-[#b07a1e] to-[#e0ab55]", icon: CupIcon },
  { id: "grill", accent: "from-[#8d3d1f] to-[#c2703f]", icon: FlameIcon },
  { id: "evening", accent: "from-[#123449] to-[#3c6c85]", icon: GlassIcon },
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
          const first = CATEGORIES.find((c) => c.daypart === d.id);
          const Icon = d.icon;
          return (
            <Reveal key={d.id} delayMs={i * 60}>
              <Link
                href={`/menu#${first?.slug ?? ""}`}
                className="group card flex h-full flex-col overflow-hidden transition-shadow duration-200 hover:shadow-lift"
              >
                <div
                  className={`flex h-32 items-end bg-gradient-to-br ${d.accent} p-5 text-white`}
                  aria-hidden="true"
                >
                  <Icon />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="font-display text-xl font-semibold">
                    {t(`daypart.${d.id}.title` as never)}
                  </h3>
                  <p className="mt-2 flex-1 text-char/70">
                    {t(`daypart.${d.id}.body` as never)}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-2 font-semibold text-rust">
                    {t("daypart.cta")}
                    <span
                      aria-hidden="true"
                      className="transition-transform duration-150 motion-safe:group-hover:translate-x-1"
                    >
                      &rarr;
                    </span>
                  </span>
                </div>
              </Link>
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

function GlassIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3h14l-6 8v7h3v3H8v-3h3v-7L5 3z" />
    </svg>
  );
}
