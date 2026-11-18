import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { addSubscriber, pushConfigured, removeSubscriber } from "@/lib/offers-store";

export const dynamic = "force-dynamic";

const Sub = z.object({
  endpoint: z
    .string()
    .url()
    .max(1000)
    .refine((u) => u.startsWith("https://")),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(4).max(100) }),
});

/** A customer turns offer notifications on (POST) or off (DELETE). */
export async function POST(req: Request) {
  const limit = rateLimit(`push-sub:${clientIp(req)}`, 20, 60 * 60_000);
  if (!limit.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  if (!pushConfigured()) return NextResponse.json({ error: "push_not_configured" }, { status: 503 });
  const parsed = Sub.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    await addSubscriber({ endpoint: parsed.data.endpoint, keys: parsed.data.keys });
  } catch {
    return NextResponse.json({ error: "save_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const limit = rateLimit(`push-sub:${clientIp(req)}`, 20, 60 * 60_000);
  if (!limit.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const parsed = z.object({ endpoint: z.string().max(1000) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  await removeSubscriber(parsed.data.endpoint).catch(() => {});
  return NextResponse.json({ ok: true });
}
