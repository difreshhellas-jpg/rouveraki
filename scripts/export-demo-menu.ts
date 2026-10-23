/**
 * Builds src/data/menu.json from the seed list, so demo mode shows exactly the
 * menu the database would hold. Run: npx tsx scripts/export-demo-menu.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { AGE_GATED_CATEGORIES, CATEGORIES } from "../src/lib/brand";
import { photoForItem } from "../src/lib/images";

const src = readFileSync("prisma/seed.ts", "utf8");
const start = src.indexOf("const items: SeedItem[] = [");
const end = src.indexOf("\n];", start);
const literal = src.slice(start + "const items: SeedItem[] = ".length, end + 2);
const seed = new Function(`return ${literal}`)() as Array<{
  name: string; nameEn: string; description: string; descriptionEn: string;
  price: number; category: string; prepTimeMinutes: number;
}>;

const counters = new Map<string, number>();
const order = new Map<string, number>(CATEGORIES.map((c, i) => [c.slug, i]));
const items = seed.map((it, i) => {
  const n = (counters.get(it.category) ?? 0) + 1;
  counters.set(it.category, n);
  return {
    id: i + 1,
    name: it.name,
    nameEn: it.nameEn,
    description: it.description,
    descriptionEn: it.descriptionEn,
    priceCents: Math.round(it.price * 100),
    category: it.category,
    image: photoForItem(it.name, it.category),
    available: true,
    prepTimeMinutes: it.prepTimeMinutes,
    requiresAgeVerification: AGE_GATED_CATEGORIES.includes(it.category),
  };
}).sort((a, b) => (order.get(a.category) ?? 999) - (order.get(b.category) ?? 999));

writeFileSync("src/data/menu.json", JSON.stringify({ items }, null, 2));
console.log(`menu.json: ${items.length} items`);
