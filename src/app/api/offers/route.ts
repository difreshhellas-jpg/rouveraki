import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isAdmin } from "@/lib/menu-store";
import { loadOffers, pushConfigured, saveOffers, subscriberCount, vapidPublicKey } from "@/lib/offers-store";
import { liveOffers } from "@/lib/offer-types";

export const dynamic = "force-dynamic";

/**
 * GET: the offers customers see now, plus the push key (null when phone
 * notifications are not set up). GET ?all=1 with x-admin-key: every offer, including
 * hidden and expired ones, and the subscriber count.
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
    return NextResponse.json(
      { offers: liveOffers(offers), pushKey: pushConfigured() ? vapidPublicKey() : null },
      { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=45" } },
    );
  } catch {
    return NextResponse.json({ offers: [], pushKey: null }, { status: 503 });
  }
}

const text = (max: number) => z.string().trim().max(max);
const Offer = z.object({
  id: z.string().regex(/^[a-z0-9-]{4,40}$/),
  title: text(80).min(1),
  titleEn: text(80).nullable(),
  text: text(400).nullable(),
  textEn: text(400).nullable(),
  badge: text(16).nullable(),
  active: z.boolean(),
  endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});
const Body = z.object({ offers: z.array(Offer).max(30) });

/** Saves the whole list (owner only). */
export async function PUT(req: Request) {
  const limit = rateLimit(`offers:${clientIp(req)}`, 60, 10 * 60_000);
  if (!limit.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  // Empty optional fields are stored as null.
  const clean = parsed.data.offers.map((o) => ({
    ...o,
    titleEn: o.titleEn || null,
    text: o.text || null,
    textEn: o.textEn || null,
    badge: o.badge || null,
  }));
  try {
    await saveOffers(clean);
  } catch {
    return NextResponse.json({ error: "save_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
