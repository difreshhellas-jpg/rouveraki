import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isAdmin } from "@/lib/menu-store";
import { loadOffers, pushConfigured, sendToSubscribers } from "@/lib/offers-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Sends one offer as a phone notification to every customer who signed up (owner only). */
export async function POST(req: Request) {
  const limit = rateLimit(`offers-notify:${clientIp(req)}`, 10, 60 * 60_000);
  if (!limit.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ error: "push_not_configured" }, { status: 503 });

  const parsed = z.object({ id: z.string().max(40) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const offer = (await loadOffers()).find((o) => o.id === parsed.data.id);
  if (!offer) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const result = await sendToSubscribers({
      title: offer.badge ? `${offer.badge} · ${offer.title}` : offer.title,
      body: offer.text ?? "Δες την προσφορά στο Ρουβεράκι",
      url: "/menu#offers",
      tag: `offer-${offer.id}`,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json({ error: "send_failed" }, { status: 502 });
  }
}
