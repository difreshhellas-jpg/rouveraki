/**
 * Hero and section photography.
 *
 * The actual URLs live in lib/images.ts. This file only re-exports them under
 * the names the components already use, plus the CSS gradient fallbacks that
 * render if an image ever fails to load.
 *
 * TODO:OWNER — to use real Rouveraki photography instead of the stock shots,
 * drop files into /public/images/ and point HERO_IMAGES in lib/images.ts at
 * them. No component changes.
 */
import { HERO_IMAGES, photo, PHOTOS } from "./images";

export type Photo = {
  src: string;
  /** Meaningful Greek alt text — this is what a screen reader announces. */
  alt: string;
  altEn: string;
};

export const HERO_PHOTOS: Photo[] = HERO_IMAGES;

export const STORY_PHOTO: Photo = {
  src: photo(PHOTOS.barInterior, 1200, 900),
  alt: "Ο χώρος του Ρουβεράκι το βράδυ",
  altEn: "Inside Rouveraki at night",
};

/** Shown behind a hero slide until its image decodes. */
export const HERO_FALLBACK_GRADIENTS = [
  "linear-gradient(135deg, #3a1d10 0%, #8d3d1f 45%, #c2703f 100%)",
  "linear-gradient(140deg, #0c2231 0%, #123449 40%, #3c6c85 100%)",
  "linear-gradient(130deg, #5a3211 0%, #a8631f 50%, #d9a45c 100%)",
];

/**
 * Per-category tint behind a menu item that has no photo. Every seeded item
 * now has one, so this only shows for an item created by hand without an
 * image URL.
 */
export const CATEGORY_TINTS: Record<string, string> = {
  pites: "linear-gradient(135deg, #8d3d1f, #c2703f)",
  souvlakia: "linear-gradient(135deg, #6f2f16, #b2502e)",
  gyros: "linear-gradient(135deg, #7a3a18, #c07a3c)",
  kalamakia: "linear-gradient(135deg, #5f3316, #a8631f)",
  zymarika: "linear-gradient(135deg, #8a5a1c, #d0a155)",
  orektika: "linear-gradient(135deg, #4c4a22, #8f8a3a)",
  salates: "linear-gradient(135deg, #2f4a2a, #6d8f4a)",
  kafedes: "linear-gradient(135deg, #2f2119, #6b4b33)",
  rofimata: "linear-gradient(135deg, #3a2618, #8a5a36)",
  chymoi: "linear-gradient(135deg, #8a5a0f, #e0ab55)",
  anapsyktika: "linear-gradient(135deg, #123449, #3c6c85)",
  pota: "linear-gradient(135deg, #2a1730, #6b3f5f)",
};

export const tintFor = (category: string): string =>
  CATEGORY_TINTS[category] ?? "linear-gradient(135deg, #3a332c, #6b6055)";
