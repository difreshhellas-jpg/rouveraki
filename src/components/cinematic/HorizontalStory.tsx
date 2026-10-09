"use client";

import Image from "next/image";
import { useI18n } from "@/i18n/LanguageProvider";
import { photo, PHOTOS } from "@/lib/images";

/**
 * Four-panel story on the luxury-web-animations `horizontal` effect: vertical
 * scroll drives a pinned sideways track, each photo parallaxes inside its
 * frame, and a hairline tracks progress. Under 768px or reduced motion the
 * engine leaves it alone and scroll.css turns the track into a native
 * swipe-and-snap carousel - the same panels, driven by the gesture a phone has.
 * Images load eagerly: lazy images inside a pin break its measurements.
 */

const PANELS = [
  { img: PHOTOS.gyrosPita, k: "grill" },
  { img: PHOTOS.mezeSpread, k: "share" },
  { img: PHOTOS.coffee, k: "morning" },
  { img: PHOTOS.barInterior, k: "night" },
] as const;

const COPY: Record<string, { el: [string, string]; en: [string, string] }> = {
  grill:   { el: ["Στα κάρβουνα", "Γύρος, καλαμάκια και πίτες, ψημένα τη στιγμή που τα ζητάς."],
             en: ["Over charcoal", "Gyros, skewers and pites, grilled the moment you order."] },
  share:   { el: ["Για μοίρασμα", "Ορεκτικά και πιάτα που μπαίνουν στη μέση του τραπεζιού."],
             en: ["To share", "Starters and plates that belong in the middle of the table."] },
  morning: { el: ["Από τις έξι", "Ο πρώτος καφές της ημέρας, πριν ξυπνήσει η μαρίνα."],
             en: ["From six", "The first coffee of the day, before the marina wakes up."] },
  night:   { el: ["Μέχρι τη μία", "Ένα ποτό όταν ησυχάσουν τα σκάφη."],
             en: ["Until one", "A drink once the boats have settled."] },
};

export default function HorizontalStory() {
  const { locale } = useI18n();

  return (
    <section
      data-fx="horizontal"
      className="fx-h bg-band text-onband"
      aria-label={locale === "en" ? "Our day" : "Η μέρα μας"}
    >
      <div className="fx-h__track">
        {PANELS.map((p, i) => {
          const copy = COPY[p.k][locale === "en" ? "en" : "el"];
          return (
            <article key={p.k} className="fx-h__panel">
              <div className="fx-h__media">
                <Image
                  src={photo(p.img, 1600, 1000)}
                  alt=""
                  width={1600}
                  height={1000}
                  loading="eager"
                  sizes="(max-width: 767px) 82vw, 62vw"
                />
              </div>
              <div className="fx-h__text max-w-xl">
                <p className="eyebrow !text-onband/60">
                  {String(i + 1).padStart(2, "0")} / {String(PANELS.length).padStart(2, "0")}
                </p>
                <h2 className="mt-2 font-display text-[clamp(1.8rem,4.5vw,3.4rem)] font-semibold leading-[1.02] tracking-[-0.02em]">
                  {copy[0]}
                </h2>
                <p className="mt-3 max-w-md text-base leading-relaxed text-onband/75 sm:text-lg">
                  {copy[1]}
                </p>
              </div>
            </article>
          );
        })}
      </div>
      <div className="fx-h__progress" aria-hidden="true"><span /></div>
    </section>
  );
}
