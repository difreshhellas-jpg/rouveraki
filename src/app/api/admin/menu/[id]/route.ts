import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withStaff } from "@/lib/auth";
import { CATEGORIES, AGE_GATED_CATEGORIES } from "@/lib/brand";
import { sanitizeText } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

const slugs = CATEGORIES.map((c) => c.slug) as [string, ...string[]];

const PatchSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    nameEn: z.string().max(255).nullable().optional(),
    description: z.string().max(600).nullable().optional(),
    descriptionEn: z.string().max(600).nullable().optional(),
    priceCents: z.number().int().min(0).max(99_999).optional(),
    category: z.enum(slugs).optional(),
    image: z.string().url().max(500).nullable().optional(),
    available: z.boolean().optional(),
    prepTimeMinutes: z.number().int().min(0).max(240).optional(),
    requiresAgeVerification: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(9999).optional(),
  })
  .strict();

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withStaff(async (req, _user, ctx: Ctx) => {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const existing = await prisma.menuItem.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const nextCategory = d.category ?? existing.category;

  const data: Prisma.MenuItemUpdateInput = {};
  if (d.name !== undefined) data.name = sanitizeText(d.name, 255);
  if (d.nameEn !== undefined) data.nameEn = d.nameEn ? sanitizeText(d.nameEn, 255) : null;
  if (d.description !== undefined)
    data.description = d.description ? sanitizeText(d.description, 600) : null;
  if (d.descriptionEn !== undefined)
    data.descriptionEn = d.descriptionEn ? sanitizeText(d.descriptionEn, 600) : null;
  if (d.priceCents !== undefined)
    data.price = new Prisma.Decimal((d.priceCents / 100).toFixed(2));
  if (d.category !== undefined) data.category = d.category;
  if (d.image !== undefined) data.image = d.image || null;
  if (d.available !== undefined) data.available = d.available;
  if (d.prepTimeMinutes !== undefined) data.prepTimeMinutes = d.prepTimeMinutes;
  if (d.sortOrder !== undefined) data.sortOrder = d.sortOrder;

  // Same rule as on create: the category forces the gate on; the toggle can
  // only ever add one.
  if (d.requiresAgeVerification !== undefined || d.category !== undefined) {
    data.requiresAgeVerification =
      AGE_GATED_CATEGORIES.includes(nextCategory) ||
      (d.requiresAgeVerification ?? existing.requiresAgeVerification) === true;
  }

  const item = await prisma.menuItem.update({ where: { id }, data });

  return NextResponse.json({
    item: { ...item, price: undefined, priceCents: Math.round(Number(item.price) * 100) },
  });
});

/**
 * DELETE is a soft delete: it flips `available` off.
 *
 * Orders store a JSON snapshot of their lines, so a hard delete would not
 * corrupt history — but a mis-tap that permanently removes a dish at 9pm on a
 * Saturday is not recoverable from the admin UI, and this is.
 */
export const DELETE = withStaff(async (_req, _user, ctx: Ctx) => {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const existing = await prisma.menuItem.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.menuItem.update({ where: { id }, data: { available: false } });
  return NextResponse.json({ ok: true, softDeleted: true });
});
