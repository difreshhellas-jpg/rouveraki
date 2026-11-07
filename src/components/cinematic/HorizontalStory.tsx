"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useI18n } from "@/i18n/LanguageProvider";
import { photo, SITE } from "@/lib/images";

/**
 * Four full-screen panels that pan sideways while the section is pinned.
 *
 * Vertical scroll drives it on every device, phones included: the outer
 * section supplies the scroll distance and the sticky rail holds the screen.
 * Browsers with CSS scroll-driven animations do the pan off the main thread;
 * for the rest (older iOS Safari) the effect below sets the same translate from
 * the scroll position, one rAF-throttled passive listener.
 */

const PANELS = [
  { img: SITE.storyGrill, k: "grill" },
  { img: SITE.storyShare, k: "share" },
  { img: SITE.storyMorning, k: "morning" },
  { img: SITE.storyNight, k: "night" },
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
  const outer = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  // Panels 2-4 sit off to the side until the pan reaches them, so the
  // browser's own lazy loading would not fetch them until they slide in (black
  // panels mid-pan). Load all four once the section is a screen away.
  const [near, setNear] = useState(false);
  useEffect(() => {
    const o = outer.current;
    if (!o) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "100% 0px" },
    );
    io.observe(o);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (CSS.supports("animation-timeline: view()")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const o = outer.current;
    const t = track.current;
    if (!o || !t) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = o.getBoundingClientRect();
      const run = o.offsetHeight - window.innerHeight;
      const p = run > 0 ? Math.min(1, Math.max(0, -r.top / run)) : 0;
      t.style.setProperty("--hstory-x", `${-p * (PANELS.length - 1) * o.clientWidth}px`);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    // The outer height is the scroll distance the pan consumes: one extra
    // viewport per panel after the first.
    <section
      ref={outer}
      className="hstory-outer relative bg-band text-onband"
      style={{
        height: `${PANELS.length * 100}svh`,
        ["--panels" as string]: PANELS.length,
      }}
      aria-label={locale === "en" ? "Our day" : "Η μέρα μας"}
    >
      <div className="hstory-rail">
        <div ref={track} className="hstory-track">
          {PANELS.map((p, i) => {
            const copy = COPY[p.k][locale === "en" ? "en" : "el"];
            return (
              <article
                key={p.k}
                className="hstory-panel relative flex h-full items-end overflow-hidden"
              >
                <Image
                  src={photo(p.img, 1600, 1200)}
                  alt=""
                  fill
                  sizes="100vw"
                  loading={near ? "eager" : "lazy"}
                  className="object-cover"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10"
                />
                <div className="relative w-full max-w-xl p-6 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:p-14">
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
