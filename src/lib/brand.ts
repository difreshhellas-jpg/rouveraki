/**
 * Confirmed brand facts (spec §0). Everything here is real and verified — do not
 * invent alternatives. Values marked TODO:OWNER were not publicly listed and must
 * be confirmed with the owner before launch.
 */

export const BRAND = {
  nameEl: "Ρουβεράκι",
  nameEn: "Rouveraki",
  taglineEl: "Ένας ανακαινισμένος χώρος στη μαρίνα του Ξυλοκάστρου",
  taglineEn: "A renovated space at the Xylokastro marina",
  address: {
    street: "Παπαγεωργίου Σπύρου 4",
    city: "Ξυλόκαστρο",
    region: "Κορινθίας",
    postalCode: "20400",
    country: "GR",
  },
  /** Dial-safe and display forms of the same number. */
  phone: { display: "27430 26683", tel: "+302743026683" },
  facebook: "https://www.facebook.com/rouveraki",
  /** Open every day 06:00–24:00. Coffee from 07:00, food 12:00–24:00. */
  hours: { opens: "06:00", closes: "00:00" },
  /** Delivery runs a narrower window than the shop itself. */
  deliveryHours: { opens: "12:00", closes: "00:00" },
  /** Approximate marina coordinates, used only for the map embed. */
  geo: { lat: 38.0784, lng: 22.6305 },
} as const;

/**
 * Menu categories, in the order they appear on the page and in the pill rail.
 * `slug` is the anchor id; `daypart` drives the three homepage daypart cards.
 */
export const CATEGORIES = [
  { slug: "pites",       el: "Πίτες τυλιχτές", en: "Wraps",         daypart: "grill"    },
  { slug: "kalamakia",   el: "Καλαμάκια",   en: "Skewers",       daypart: "grill"    },
  { slug: "merides",     el: "Μερίδες",     en: "Grill plates",  daypart: "grill"    },
  { slug: "poikilies",   el: "Ποικιλίες",   en: "Sharing platters", daypart: "grill" },
  { slug: "burger",      el: "Club & Burger", en: "Club & Burger", daypart: "grill"  },
  { slug: "santouits",   el: "Σάντουιτς",   en: "Sandwiches",    daypart: "grill"    },
  { slug: "orektika",    el: "Ορεκτικά",    en: "Starters",      daypart: "grill"    },
  { slug: "salates",     el: "Σαλάτες",     en: "Salads",        daypart: "grill"    },
  { slug: "zymarika",    el: "Ζυμαρικά",    en: "Pasta",         daypart: "grill"    },
  { slug: "psari",       el: "Ψάρι",        en: "Fish",          daypart: "grill"    },
  { slug: "kafedes",     el: "Καφέδες",     en: "Coffee",        daypart: "morning"  },
  { slug: "rofimata",    el: "Ροφήματα",    en: "Hot drinks",    daypart: "morning"  },
  { slug: "chymoi",      el: "Χυμοί",       en: "Juices",        daypart: "morning"  },
  { slug: "anapsyktika", el: "Αναψυκτικά",  en: "Soft drinks",   daypart: "evening"  },
  { slug: "mpyres",      el: "Μπύρες",      en: "Beer",          daypart: "evening"  },
  { slug: "pota",        el: "Κρασιά - Ποτά", en: "Wine & spirits", daypart: "evening" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

/**
 * Categories that need an 18+ confirmation at checkout. Empty: the owner chose
 * not to ask (2026-10-31). Add slugs back here to switch the check on again.
 */
export const AGE_GATED_CATEGORIES: readonly string[] = [];

export const categoryBySlug = (slug: string) =>
  CATEGORIES.find((c) => c.slug === slug);

/**
 * Delivery zones.
 * TODO:OWNER — Rouveraki does not publish zones or minimums anywhere I could
 * find. These are placeholders with a realistic shape; confirm the real zone
 * names, minimum order values and fees with the owner and edit only this block.
 */
export type DeliveryZone = {
  id: string;
  el: string;
  en: string;
  minimumOrder: number;
  deliveryFee: number;
  etaMinutes: number;
};

export const DELIVERY_ZONES: DeliveryZone[] = [
  { id: "xylokastro-kentro", el: "Ξυλόκαστρο - Κέντρο & Μαρίνα", en: "Xylokastro - Centre & Marina", minimumOrder: 6,  deliveryFee: 0,   etaMinutes: 30 },
  { id: "xylokastro-periferia", el: "Ξυλόκαστρο - Περιφέρεια",   en: "Xylokastro - Outskirts",       minimumOrder: 10, deliveryFee: 1.5, etaMinutes: 40 },
  { id: "sykia-pefkias",     el: "Συκιά / Πευκιάς",              en: "Sykia / Pefkias",              minimumOrder: 12, deliveryFee: 2.5, etaMinutes: 45 },
];

export const zoneById = (id: string) => DELIVERY_ZONES.find((z) => z.id === id);

/** Default kitchen ETA offered when staff accept without editing it. */
export const DEFAULT_ETA_MINUTES = { delivery: 40, pickup: 40 } as const;

/** Window in which a customer can still cancel themselves (spec §4). */
export const CUSTOMER_CANCEL_GRACE_SECONDS = 120;

/** Reasons staff pick from when rejecting (spec §4 — "short list"). */
export const REJECTION_REASONS = [
  { id: "out_of_stock",     el: "Εξαντλήθηκε προϊόν",           en: "Item out of stock" },
  { id: "too_busy",         el: "Υπερβολικός φόρτος κουζίνας",  en: "Kitchen at capacity" },
  { id: "outside_zone",     el: "Εκτός ζώνης διανομής",         en: "Outside delivery zone" },
  { id: "closing_soon",     el: "Κλείνουμε σύντομα",            en: "Closing shortly" },
  { id: "cannot_reach",     el: "Δεν καταφέραμε να επικοινωνήσουμε", en: "Could not reach customer" },
  { id: "other",            el: "Άλλος λόγος",                  en: "Other" },
] as const;
