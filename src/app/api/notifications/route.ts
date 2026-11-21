import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isAdmin } from "@/lib/menu-store";
import { loadOffers, pushConfigured } from "@/lib/offers-store";
import {
  MAX_DAYS_AHEAD,
  addScheduled,
  athensToUtc,
  cancelScheduled,
  lastRunAt,
  loadSchedule,
} from "@/lib/notify-schedule";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store" };

/** The owner's scheduled offer notifications (owner only). */
export async function GET(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: noStore });
  try {
    const [items, lastRun] = await Promise.all([loadSchedule(), lastRunAt()]);
    return NextResponse.json(
      { items, lastRun, push: pushConfigured(), pinger: Boolean(process.env.CRON_SECRET?.trim()) },
      { headers: noStore },
    );
  } catch {
    return NextResponse.json({ error: "store_unavailable" }, { status: 503, headers: noStore });
  }
}

const Body = z.object({
  offerId: z.string().max(40),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  body: z.string().trim().max(200).nullable().optional(),
});

/** Schedules one notification for a date and time in Greece. */
export async function POST(req: Request) {
  const limit = rateLimit(`notif-schedule:${clientIp(req)}`, 30, 60 * 60_000);
  if (!limit.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { offerId, date, time, body } = parsed.data;

  const sendAt = athensToUtc(date, time);
  if (!Number.isFinite(sendAt)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (sendAt < Date.now() + 30_000) return NextResponse.json({ error: "in_past" }, { status: 400 });
  if (sendAt > Date.now() + MAX_DAYS_AHEAD * 86_400_000) {
    return NextResponse.json({ error: "too_far" }, { status: 400 });
  }
  const offer = (await loadOffers()).find((o) => o.id === offerId);
  if (!offer) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    const item = await addScheduled({ offerId, offerTitle: offer.title, body: body || null, sendAt });
    return NextResponse.json({ ok: true, item });
  } catch (e) {
    const tooMany = e instanceof Error && e.message === "too_many";
    return NextResponse.json({ error: tooMany ? "too_many" : "save_failed" }, { status: tooMany ? 400 : 502 });
  }
}

/** Cancels one that has not gone out yet: DELETE ?id=... */
export async function DELETE(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[a-f0-9]{12}$/.test(id)) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    const ok = await cancelScheduled(id);
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not_found" }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "save_failed" }, { status: 502 });
  }
}
