import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withStaff } from "@/lib/auth";
import { CATEGORIES, AGE_GATED_CATEGORIES } from "@/lib/brand";
import { sanitizeText } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

const slugs = CATEGORIES.map((c) => c.slug) as [string, ...string[]];

const ItemSchema = z.object({
  name: z.string().min(1).max(255),
  nameEn: z.string().max(255).optional().nullable(),
  description: z.string().max(600).optional().nullable(),
  descriptionEn: z.string().max(600).optional().nullable(),
  // DECIMAL(5,2) tops out at 999.99.
  priceCents: z.number().int().min(0).max(99_999),
  category: z.enum(slugs),
  image: z.string().url().max(500).optional().nullable(),
  available: z.boolean().optional().default(true),
  prepTimeMinutes: z.number().int().min(0).max(240).optional().default(10),
  requiresAgeVerification: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional().default(0),
});

/** GET /api/admin/menu — full list, including unavailable items. */
export const GET = withStaff(async () => {
  const items = await prisma.menuItem.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
  });
  return NextResponse.json({
    items: items.map((i) => ({
      ...i,
      price: undefined,
      priceCents: Math.round(Number(i.price) * 100),
    })),
  });
});

/** POST /api/admin/menu — create an item. */
export const POST = withStaff(async (req) => {
  const parsed = ItemSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const item = await prisma.menuItem.create({
    data: {
      name: sanitizeText(d.name, 255),
      nameEn: d.nameEn ? sanitizeText(d.nameEn, 255) : null,
      description: d.description ? sanitizeText(d.description, 600) : null,
      descriptionEn: d.descriptionEn ? sanitizeText(d.descriptionEn, 600) : null,
      price: new Prisma.Decimal((d.priceCents / 100).toFixed(2)),
      category: d.category,
      image: d.image || null,
      available: d.available,
      prepTimeMinutes: d.prepTimeMinutes,
      // The category decides the age gate. An explicit true can add one, but a
      // drink filed under Ποτά can never be un-gated by a slip in the form.
      requiresAgeVerification:
        AGE_GATED_CATEGORIES.includes(d.category) ||
        d.requiresAgeVerification === true,
      sortOrder: d.sortOrder,
    },
  });

  return NextResponse.json({
    item: { ...item, price: undefined, priceCents: Math.round(Number(item.price) * 100) },
  });
});
