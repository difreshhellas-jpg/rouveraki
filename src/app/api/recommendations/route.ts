import { NextResponse } from "next/server";
import { z } from "zod";
import { CATEGORIES } from "@/lib/brand";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isAdmin, loadLiveMenu } from "@/lib/menu-store";
import { loadRecommendations, saveRecommendations } from "@/lib/recommendations-store";
import type { PublicRecommendation } from "@/lib/offer-types";

export const dynamic = "force-dynamic";

/**
 * GET: the active recommendations whose product is on the menu and available,
 * each with its product. GET ?all=1 with x-admin-key: the owner's full list.
 */
export async function GET(req: Request) {
  try {
    const { recs, saved } = await loadRecommendations();
    if (new URL(req.url).searchParams.has("all")) {
      if (!isAdmin(req)) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
      }
      return NextResponse.json({ recs, saved }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const menu = new Map((await loadLiveMenu({ cached: true })).map((m) => [m.id, m]));
    const out: PublicRecommendation[] = recs.flatMap((r) => {
      const m = menu.get(r.itemId);
      if (!r.active || !m || !m.available) return [];
      const item = {
        id: m.id,
        name: m.name,
        nameEn: m.nameEn,
        priceCents: m.priceCents,
        category: m.category,
        image: m.image,
        available: m.available,
      };
      return [{ ...r, item }];
    });
    return NextResponse.json(
      { recs: out },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } },
    );
  } catch {
    return NextResponse.json({ recs: [] }, { status: 503 });
  }
}

const slugs = CATEGORIES.map((c) => c.slug) as [string, ...string[]];
const Rec = z.object({
  id: z.string().regex(/^[a-z0-9-]{3,40}$/),
  whenCategories: z.array(z.enum(slugs)).min(1).max(30),
  itemId: z.number().int().positive(),
  active: z.boolean(),
});
const Body = z.object({ recs: z.array(Rec).max(200) });

/** Saves the whole list (owner only). */
export async function PUT(req: Request) {
  const limit = rateLimit(`recs:${clientIp(req)}`, 60, 10 * 60_000);
  if (!limit.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const menu = new Set((await loadLiveMenu()).map((m) => m.id));
  if (parsed.data.recs.some((r) => !menu.has(r.itemId))) {
    return NextResponse.json({ error: "unknown_item" }, { status: 400 });
  }
  try {
    await saveRecommendations(parsed.data.recs);
  } catch {
    return NextResponse.json({ error: "save_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
