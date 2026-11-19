import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isAdmin } from "@/lib/menu-store";
import { saveOfferImage } from "@/lib/offers-store";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 1_500_000; // the shop app shrinks photos well below this first

/** The owner uploads a banner photo for an offer; returns its URL. */
export async function POST(req: Request) {
  const limit = rateLimit(`offer-img:${clientIp(req)}`, 30, 10 * 60_000);
  if (!limit.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !TYPES.includes(file.type) || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }
  try {
    const url = await saveOfferImage(file.type, Buffer.from(await file.arrayBuffer()));
    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "upload_failed" }, { status: 502 });
  }
}
