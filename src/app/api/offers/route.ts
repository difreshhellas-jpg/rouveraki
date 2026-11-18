import { NextResponse } from "next/server";
import { z } from "zod";
import { CATEGORIES } from "@/lib/brand";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isAdmin, loadLiveMenu } from "@/lib/menu-store";
import { loadOffers, pushConfigured, saveOffers, subscriberCount, vapidPublicKey } from "@/lib/offers-store";
import { liveOffers, type PublicOffer } from "@/lib/offer-types";

export const dynamic = "force-dynamic";

/**
 * GET: the offers customers see now (each deal with its product), plus the
 * push key (null when phone notifications are not set up).
 * GET ?all=1 with x-admin-key: every offer, including hidden and expired
 * ones, and the subscriber count.
 */
export async function GET(req: Request) {
  try {
    const offers = await loadOffers();
    // The owner's list has its own URL (?all=1) so the CDN never hands the
    // owner the cached public copy, or anyone else the owner's copy.
    if (new URL(req.url).searchParams.has("all")) {
      if (!isAdmin(req)) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
      }
      return NextResponse.json(
        { offers, push: pushConfigured(), subscribers: pushConfigured() ? await subscriberCount() : 0 },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    const live = liveOffers(offers);
    let out: PublicOffer[] = live;
    if (live.some((o) => o.deal)) {
      const byId = new Map((await loadLiveMenu({ cached: true })).map((m) => [m.id, m]));
      out = live.flatMap((o) => {
        if (!o.deal) return [o];
        const m = byId.get(o.deal.itemId);
        // A deal on a product that left the menu is not shown.
        if (!m) return [];
        const item = {
          id: m.id,
          name: m.name,
          nameEn: m.nameEn,
          priceCents: m.priceCents,
          category: m.category,
          image: m.image,
          available: m.available,
        };
        return [{ ...o, item }];
      });
    }
    return NextResponse.json(
      { offers: out, pushKey: pushConfigured() ? vapidPublicKey() : null },
      { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=45" } },
    );
  } catch {
    return NextResponse.json({ offers: [], pushKey: null }, { status: 503 });
  }
}

const slugs = CATEGORIES.map((c) => c.slug) as [string, ...string[]];
const text = (max: number) => z.string().trim().max(max);
const price = z.number().int().min(0).max(100_000);
const Deal = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("item"), itemId: z.number().int().positive(), priceCents: price }),
  z.object({
    kind: z.literal("addon"),
    itemId: z.number().int().positive(),
    priceCents: price,
    withCategories: z.array(z.enum(slugs)).max(30),
  }),
]);
const Offer = z.object({
  id: z.string().regex(/^[a-z0-9-]{4,40}$/),
  title: text(80).min(1),
  titleEn: text(80).nullable(),
  text: text(400).nullable(),
  textEn: text(400).nullable(),
  badge: text(16).nullable(),
  active: z.boolean(),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  deal: Deal.nullable().optional(),
});
const Body = z.object({ offers: z.array(Offer).max(30) });

/** Saves the whole list (owner only). */
export async function PUT(req: Request) {
  const limit = rateLimit(`offers:${clientIp(req)}`, 60, 10 * 60_000);
  if (!limit.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const menu = new Map((await loadLiveMenu()).map((m) => [m.id, m]));
  for (const o of parsed.data.offers) {
    if (!o.deal) continue;
    const m = menu.get(o.deal.itemId);
    if (!m) return NextResponse.json({ error: "unknown_item", title: o.title }, { status: 400 });
    // A special price is a lower price; otherwise it is not an offer.
    if (o.deal.kind === "item" && o.deal.priceCents >= m.priceCents) {
      return NextResponse.json({ error: "price_not_lower", title: o.title }, { status: 400 });
    }
  }
  // Empty optional fields are stored as null.
  const clean = parsed.data.offers.map((o) => ({
    ...o,
    titleEn: o.titleEn || null,
    text: o.text || null,
    textEn: o.textEn || null,
    badge: o.badge || null,
    deal: o.deal ?? null,
  }));
  try {
    await saveOffers(clean);
  } catch {
    return NextResponse.json({ error: "save_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
