import type { Metadata } from "next";
import { DEMO_MODE } from "@/lib/demo/config";
import { CATEGORIES } from "@/lib/brand";
import type { MenuItemDTO } from "@/lib/menu-types";
import MenuBrowser from "@/components/MenuBrowser";
import MenuHeader from "@/components/MenuHeader";

export const metadata: Metadata = {
  title: "Μενού",
  description:
    "Πίτες, καλαμάκια, μερίδες στα κάρβουνα, burger, σαλάτες, ζυμαρικά και ποτά. Παραγγελία online με διανομή στο Ξυλόκαστρο.",
};

// The menu is read fresh so an availability toggle in the admin panel shows up
// on the next page load rather than after a rebuild.
export const dynamic = "force-dynamic";

async function loadMenu(): Promise<MenuItemDTO[]> {
  // Demo mode: no database; the owner-edited menu lives in Vercel Blob.
  if (DEMO_MODE) {
    const { loadLiveMenu } = await import("@/lib/menu-store");
    return loadLiveMenu();
  }

  const { prisma } = await import("@/lib/prisma");
  const order = new Map<string, number>(CATEGORIES.map((c, i) => [c.slug, i]));

  const items = await prisma.menuItem.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  return items
    .map((i) => ({
      id: i.id,
      name: i.name,
      nameEn: i.nameEn,
      description: i.description,
      descriptionEn: i.descriptionEn,
      priceCents: Math.round(Number(i.price) * 100),
      category: i.category,
      image: i.image,
      available: i.available,
      prepTimeMinutes: i.prepTimeMinutes,
      requiresAgeVerification: i.requiresAgeVerification,
    }))
    .sort(
      (a, b) => (order.get(a.category) ?? 999) - (order.get(b.category) ?? 999),
    );
}

export default async function MenuPage() {
  const items = await loadMenu();

  return (
    <>
      <MenuHeader />
      <MenuBrowser items={items} />
    </>
  );
}
