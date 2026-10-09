"use client";

import Image from "next/image";
import { useI18n } from "@/i18n/LanguageProvider";
import { photo, PHOTOS } from "@/lib/images";

/**
 * Four-panel story that pans sideways while the section is pinned.
 *
 * The panning is a CSS scroll-driven animation on the track, with the outer
 * section supplying the scroll distance, so nothing runs on the main thread.
 *
 * On a phone this does NOT become a vertical list. Pinning the viewport and
 * hijacking vertical scroll is genuinely hostile on touch, but the horizontal
 * gesture itself is not: the same track becomes a real swipeable scroll-snap
 * carousel. Same content, same left-to-right reading, driven by the gesture a
 * phone actually has.
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
    // The outer height is the scroll distance the pan consumes: one extra
    // viewport per panel after the first.
    <section
      className="hstory-outer relative bg-band text-onband"
      style={{
        height: `${PANELS.length * 100}svh`,
        ["--panels" as string]: PANELS.length,
      }}
      aria-label={locale === "en" ? "Our day" : "Η μέρα μας"}
    >
      <div className="hstory-rail">
        <div className="hstory-track">
          {PANELS.map((p, i) => {
            const copy = COPY[p.k][locale === "en" ? "en" : "el"];
            return (
              <article
                key={p.k}
                className="hstory-panel relative flex min-h-[70svh] items-end overflow-hidden md:min-h-0"
              >
                <Image
                  src={photo(p.img, 1600, 1200)}
                  alt=""
                  fill
                  sizes="100vw"
                  className="object-cover"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10"
                />
                <div className="relative w-full max-w-xl p-8 sm:p-14">
                  <p className="eyebrow !text-white/60">
                    {String(i + 1).padStart(2, "0")} / {String(PANELS.length).padStart(2, "0")}
                  </p>
                  <h2 className="mt-3 font-display text-[clamp(2rem,6vw,4rem)] font-semibold leading-[1.02] tracking-[-0.02em] text-white">
                    {copy[0]}
                  </h2>
                  <p className="mt-4 max-w-md text-base leading-relaxed text-white/80 sm:text-lg">
                    {copy[1]}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
