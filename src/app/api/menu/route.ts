import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CATEGORIES } from "@/lib/brand";

export const dynamic = "force-dynamic";

/**
 * Public menu. Returns every item including unavailable ones — the UI greys
 * those out rather than hiding them, so a regular's favourite does not silently
 * vanish and leave them wondering.
 */
export async function GET() {
  const order = new Map<string, number>(CATEGORIES.map((c, i) => [c.slug, i]));

  const items = await prisma.menuItem.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
  });

  const payload = items
    .map((i) => ({
      id: i.id,
      name: i.name,
      nameEn: i.nameEn,
      description: i.description,
      descriptionEn: i.descriptionEn,
      // Decimal does not survive JSON.stringify as a number; send cents.
      priceCents: Math.round(Number(i.price) * 100),
      category: i.category,
      image: i.image,
      available: i.available,
      prepTimeMinutes: i.prepTimeMinutes,
      requiresAgeVerification: i.requiresAgeVerification,
    }))
    .sort((a, b) => {
      const ca = order.get(a.category) ?? 999;
      const cb = order.get(b.category) ?? 999;
      return ca - cb;
    });

  return NextResponse.json(
    { items: payload },
    {
      headers: {
        // Short shared cache: the menu changes rarely, but a price fix should
        // reach customers within a minute, not an hour.
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
