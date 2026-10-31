import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isAdmin, saveMenuImage } from "@/lib/menu-store";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 3 * 1024 * 1024; // the admin screen shrinks photos well below this first

/** Uploads one menu photo to the Blob store and returns its public URL. */
export async function POST(req: Request) {
  const limit = rateLimit(`live-menu-img:${clientIp(req)}`, 40, 10 * 60_000);
  if (!limit.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !TYPES.includes(file.type) || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }
  try {
    return NextResponse.json({ url: await saveMenuImage(file) });
  } catch {
    return NextResponse.json({ error: "upload_failed" }, { status: 502 });
  }
}
