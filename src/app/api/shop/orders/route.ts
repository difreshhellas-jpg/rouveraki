import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isAdmin } from "@/lib/menu-store";
import { listAdmin, placeOrder, PlaceInput } from "@/lib/order-store";

export const dynamic = "force-dynamic";

/** Demo-mode shared orders. POST places one (public); GET lists them for the shop (password). */
export async function POST(req: Request) {
  const limit = rateLimit(`shop-order:${clientIp(req)}`, 8, 10 * 60_000);
  if (!limit.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const parsed = PlaceInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  try {
    const r = await placeOrder(parsed.data);
    return r.ok
      ? NextResponse.json(r.data)
      : NextResponse.json({ error: r.error, ...r.extra }, { status: r.status ?? 400 });
  } catch {
    return NextResponse.json({ error: "menu_unavailable" }, { status: 503 });
  }
}

export async function GET(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const view = new URL(req.url).searchParams.get("view") === "all" ? "all" : "live";
  try {
    return NextResponse.json({ orders: await listAdmin(view) });
  } catch {
    return NextResponse.json({ error: "orders_unavailable" }, { status: 503 });
  }
}
