"use client";

import Image from "next/image";
import { useI18n } from "@/i18n/LanguageProvider";
import { photo, PHOTOS } from "@/lib/images";

/**
 * A full-bleed panel that wipes upward as the reader scrolls through it,
 * revealing the next section underneath. Reads as a scene cut.
 *
 * clip-path is the right tool here: it reveals what is genuinely behind the
 * panel rather than fading a colour over it, so the section below appears to
 * be uncovered rather than cross-faded into.
 *
 * The panel carries a photograph, not a flat colour. An earlier version wiped
 * band (#050403) away to reveal paper (#0c0a09): the animation ran correctly
 * and was completely invisible, because a scene cut between two near-blacks is
 * not a scene cut. Whatever is being wiped away has to be worth looking at.
 *
 * Where scroll-driven animations are unavailable, or motion is reduced, the
 * outer element collapses to a short band (globals.css) — never a tall blank
 * screen waiting for an animation that will not run.
 */
export default function ScrollBreak({
  heightSvh = 160,
}: {
  /** Scroll distance the wipe consumes. */
  heightSvh?: number;
}) {
  const { pick } = useI18n();

  return (
    <div className="wipe-outer relative" style={{ height: `${heightSvh}svh` }}>
      <div className="wipe-panel relative grid place-items-center overflow-hidden bg-band">
        <Image
          src={photo(PHOTOS.patty, 1800, 1100)}
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
        />
        {/* Weighted, not flat. A flat 65% over an already dark charcoal shot
            rendered the panel as pure black and threw the photograph away. */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.38) 100%)",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 mix-blend-soft-light"
          style={{
            background:
              "radial-gradient(90% 70% at 50% 100%, rgb(var(--accent-rgb) / 0.5), transparent 65%)",
          }}
        />

        <div className="relative px-6 text-center">
          <p className="eyebrow !text-white/55">
            {pick("Ρουβεράκι", "Rouveraki")}
          </p>
          <p className="mx-auto mt-4 max-w-3xl font-display text-[clamp(1.9rem,5.5vw,4rem)] font-semibold leading-[1.05] tracking-[-0.02em] text-white">
            {pick("Στα κάρβουνα, με την ώρα τους.", "Over charcoal, in their own time.")}
          </p>
        </div>
      </div>
    </div>
  );
}
