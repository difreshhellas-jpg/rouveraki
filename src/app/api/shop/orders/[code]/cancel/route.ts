import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { cancelByCustomer } from "@/lib/order-store";

/** Customer cancels inside the grace window. */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const limit = rateLimit(`shop-cancel:${clientIp(req)}`, 10, 10 * 60_000);
  if (!limit.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const r = await cancelByCustomer((await params).code);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status ?? 400 });
}
