/**
 * Photography.
 *
 * NOTE ON source.unsplash.com: that endpoint was retired by Unsplash and now
 * returns 503, so it is not used here. These are direct Unsplash CDN URLs,
 * which need no API key and were each opened and checked to be the right
 * subject before being assigned to a category.
 *
 * Every menu item carries its own `image` field in the database. These
 * category defaults only fill in items that have none, so swapping in real
 * Rouveraki photography later is a data change, not a code change: set
 * `menu_items.image` per item from /admin/menu and nothing here is touched.
 */

const CDN = "https://images.unsplash.com";

/**
 * width/height/crop are appended per use site so one photo serves every size.
 * Takes an Unsplash id ("photo-...") or a full Pexels URL without a query.
 */
export const photo = (id: string, w = 800, h = 800): string =>
  id.startsWith("https://images.pexels.com/")
    ? `${id}?auto=compress&cs=tinysrgb&w=${w}&h=${h}&fit=crop`
    : `${CDN}/${id}?w=${w}&h=${h}&fit=crop&auto=format&q=70`;

/** Verified subjects. The comment is what the photo actually shows. */
export const PHOTOS = {
  gyrosPita: "photo-1529006557810-274b9b2fc783", // gyros in pita with fries
  mezeSpread: "photo-1600891964599-f61ba0e24092", // wings, dip, sharing plates
  pasta: "photo-1621996346565-e3dbc646d9a9", // penne in tomato sauce
  salad: "photo-1546069901-ba9599a7e63c", // mixed salad bowl
  coffee: "photo-1495474472287-4d71bcdd2085", // three coffees, overhead
  barInterior: "photo-1514933651103-005eec06c04b", // lit bar counter at night
  cocktails: "photo-1544145945-f90425340c7e", // three cocktails
  spirit: "photo-1470337458703-46ad1756a187", // spirit poured over ice
  wine: "photo-1510812431401-41d2bd2722f3", // red wine glasses, toasting
  bread: "photo-1509440159596-0249088772ff", // rustic loaves
  patty: "photo-1521305916504-4a1121188589", // grilled patty in a bun
} as const;

/**
 * Site photography, hand-picked 2026-11-01 from Pexels (free licence, no
 * attribution needed). The comment is what each photo shows.
 */
export const SITE = {
  heroPita: "https://images.pexels.com/photos/32727455/pexels-photo-32727455.jpeg", // gyros pita in hand, white Greek wall
  heroMeze: "https://images.pexels.com/photos/28845495/pexels-photo-28845495.jpeg", // meze spread from above
  heroCoffee: "https://images.pexels.com/photos/18968046/pexels-photo-18968046.jpeg", // coffee on a blue table by the sea
  dayMorning: "https://images.pexels.com/photos/39526245/pexels-photo-39526245.jpeg", // cappuccino, seaside terrace
  dayGrill: "https://images.pexels.com/photos/30215494/pexels-photo-30215494.jpeg", // souvlaki skewers on the grill
  dayEvening: "https://images.pexels.com/photos/36030407/pexels-photo-36030407.jpeg", // seaside terrace at dusk, string lights
  storyGrill: "https://images.pexels.com/photos/38602968/pexels-photo-38602968.jpeg", // skewers over charcoal
  storyShare: "https://images.pexels.com/photos/27177297/pexels-photo-27177297.jpeg", // hands sharing meze plates
  storyMorning: "https://images.pexels.com/photos/24389744/pexels-photo-24389744.jpeg", // moka pot in a stone window over the sea
  storyNight: "https://images.pexels.com/photos/5029891/pexels-photo-5029891.jpeg", // waterfront taverna lit at night
  breakBurger: "https://images.pexels.com/photos/36554232/pexels-photo-36554232.jpeg", // burger close-up
  storyBar: "https://images.pexels.com/photos/36964863/pexels-photo-36964863.jpeg", // warm-lit bar counter
} as const;

/**
 * Default photo per menu category.
 *
 * TODO:OWNER — chymoi (juices) and anapsyktika (soft drinks) currently borrow
 * the nearest matching shot. They are the two categories most worth
 * photographing first.
 */
const CATEGORY_PHOTO: Record<string, string> = {
  pites: PHOTOS.gyrosPita,
  kalamakia: PHOTOS.gyrosPita,
  merides: PHOTOS.gyrosPita,
  poikilies: PHOTOS.mezeSpread,
  burger: PHOTOS.patty,
  santouits: PHOTOS.patty,
  psari: PHOTOS.mezeSpread,
  mpyres: PHOTOS.barInterior,
  zymarika: PHOTOS.pasta,
  orektika: PHOTOS.mezeSpread,
  salates: PHOTOS.salad,
  kafedes: PHOTOS.coffee,
  rofimata: PHOTOS.coffee,
  chymoi: PHOTOS.cocktails,
  anapsyktika: PHOTOS.cocktails,
  pota: PHOTOS.spirit,
};

export const categoryPhoto = (category: string, w = 800, h = 800): string =>
  photo(CATEGORY_PHOTO[category] ?? PHOTOS.mezeSpread, w, h);

/**
 * Per-item overrides, matched on a keyword in the Greek name. Keeps a wine
 * bottle from showing a whisky glass without needing a photo per row.
 */
const KEYWORD_PHOTO: Array<[RegExp, string]> = [
  [/κρασ[ίι]/i, PHOTOS.wine],
  [/cocktail|spritz/i, PHOTOS.cocktails],
  [/μπιφτ[έε]κι/i, PHOTOS.patty],
  [/ψωμ|σκ[όο]ρδου/i, PHOTOS.bread],
  [/μπ[ύυ]ρα/i, PHOTOS.barInterior],
];

export function photoForItem(
  name: string,
  category: string,
  w = 800,
  h = 800,
): string {
  for (const [pattern, id] of KEYWORD_PHOTO) {
    if (pattern.test(name)) return photo(id, w, h);
  }
  return categoryPhoto(category, w, h);
}

/** Homepage hero. Three slides, crossfaded. */
export const HERO_IMAGES = [
  {
    src: photo(SITE.heroPita, 2000, 1400),
    alt: "Πίτα γύρο στο χέρι",
    altEn: "Gyros pita in hand",
  },
  // The bar-interior shot is kept for the story section. Under the hero's
  // legibility scrim it read as a solid black frame, so the middle slide is a
  // bright food shot instead.
  {
    src: photo(SITE.heroMeze, 2000, 1400),
    alt: "Μεζέδες και πιάτα για μοίρασμα",
    altEn: "Meze and sharing plates",
  },
  {
    src: photo(SITE.heroCoffee, 2000, 1400),
    alt: "Καφές δίπλα στη θάλασσα",
    altEn: "Coffee by the sea",
  },
];
