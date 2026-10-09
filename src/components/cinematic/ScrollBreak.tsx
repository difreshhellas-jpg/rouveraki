"use client";

import Image from "next/image";
import { useI18n } from "@/i18n/LanguageProvider";
import { photo, PHOTOS } from "@/lib/images";

/**
 * Scene cut into the menu: the luxury-web-animations `section-wipe` ("rise").
 * A rounded inset opens to full bleed as the section enters, while the photo
 * settles inside it. It carries a photograph and a display line on purpose: a
 * wipe between two near-black flats animates perfectly and cannot be seen.
 */
export default function ScrollBreak() {
  const { pick } = useI18n();

  return (
    <section
      data-fx="section-wipe"
      data-wipe="rise"
      className="relative h-[100svh] overflow-hidden bg-band"
    >
      <div className="fx-wipe__inner absolute inset-0 grid place-items-center">
        <Image src={photo(PHOTOS.patty, 1800, 1100)} alt="" fill sizes="100vw" className="object-cover" />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.38) 100%)",
          }}
        />
        <div className="relative px-6 text-center">
          <p className="eyebrow !text-white/55">{pick("Ρουβεράκι", "Rouveraki")}</p>
          <p
            data-fx="split-reveal"
            data-split="words"
            className="mx-auto mt-4 max-w-3xl font-display text-[clamp(1.9rem,5.5vw,4rem)] font-semibold leading-[1.05] tracking-[-0.02em] text-white"
          >
            {pick("Στα κάρβουνα, με την ώρα τους.", "Over charcoal, in their own time.")}
          </p>
        </div>
      </div>
    </section>
  );
}
