"use client";

import Image from "next/image";
import { useI18n } from "@/i18n/LanguageProvider";
import { STORY_PHOTO } from "@/lib/photos";
import { BRAND } from "@/lib/brand";
import Reveal from "./Reveal";

/**
 * TODO:OWNER — this needs 2–3 real sentences from the owner about the space.
 *
 * Unlike a taverna with thirty years of public history, Rouveraki's story is
 * thin online, so nothing here is invented: the copy below is built only from
 * facts we actually have (renovated space, marina location, all-day hours).
 * Replace `storyParagraphs` with the owner's own words when you have them.
 */
export default function StorySection() {
  const { t, pick, locale } = useI18n();

  const storyParagraphs =
    locale === "en"
      ? [
          "A renovated space on the Xylokastro marina, open from six in the morning until one at night.",
          "Coffee and juice for the early walk along the water, the charcoal grill through the afternoon and evening, and a quiet drink once the boats have settled.",
        ]
      : [
          "Ένας ανακαινισμένος χώρος στη μαρίνα του Ξυλοκάστρου, ανοιχτός από τις έξι το πρωί μέχρι τη μία τη νύχτα.",
          "Καφές και χυμός για την πρωινή βόλτα δίπλα στο νερό, η ψησταριά στα κάρβουνα το απόγευμα και το βράδυ, και ένα ήσυχο ποτό όταν ησυχάσουν τα σκάφη.",
        ];

  return (
    <section className="tex-wood bg-surface/60 py-20 sm:py-28">
      <div className="mx-auto grid max-w-content items-center gap-12 px-4 sm:px-6 lg:grid-cols-2">
        <Reveal>
          <h2 className="font-display text-[clamp(1.9rem,5vw,3rem)] font-bold leading-tight">
            {t("story.title")}
          </h2>
          <div className="tex-rope mt-6 w-24" />
          <div className="mt-6 space-y-4 text-lg leading-relaxed text-char/80">
            {storyParagraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <p className="mt-8 font-display text-xl italic text-rust">
            {pick(BRAND.taglineEl, BRAND.taglineEn)}
          </p>
        </Reveal>

        <Reveal delayMs={80}>
          <div className="relative aspect-[4/3] overflow-hidden rounded-card shadow-lift">
            <Image
              src={STORY_PHOTO.src}
              alt={pick(STORY_PHOTO.alt, STORY_PHOTO.altEn)}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
