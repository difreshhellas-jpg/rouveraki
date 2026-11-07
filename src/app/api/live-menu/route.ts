import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { CATEGORIES } from "@/lib/brand";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { MENU_TAG, isAdmin, loadLiveMenuDoc, saveLiveMenu } from "@/lib/menu-store";

export const dynamic = "force-dynamic";

/** Demo-mode menu, shared by every visitor. GET is public; PUT needs the owner's password. */
export async function GET() {
  try {
    return NextResponse.json(await loadLiveMenuDoc({ strict: true }));
  } catch {
    return NextResponse.json({ error: "menu_unavailable" }, { status: 503 });
  }
}

const slugs = CATEGORIES.map((c) => c.slug) as [string, ...string[]];
const text = (max: number) => z.string().trim().max(max);

const Item = z.object({
  id: z.number().int().positive(),
  name: text(120).min(1),
  nameEn: text(120).nullable(),
  description: text(600).nullable(),
  descriptionEn: text(600).nullable(),
  priceCents: z.number().int().min(0).max(100_000),
  category: z.enum(slugs),
  // A site path (/images/...) or an https URL on a host next/image allows;
  // anything else would break the customer menu page when it renders.
  image: z
    .string()
    .max(600)
    .refine(isAllowedImage, "image_host_not_allowed")
    .nullable(),
  available: z.boolean(),
  prepTimeMinutes: z.number().int().min(0).max(240),
  requiresAgeVerification: z.literal(false).default(false),
});

const Body = z.object({ items: z.array(Item).max(500) });

function isAllowedImage(src: string): boolean {
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  try {
    const u = new URL(src);
    return (
      u.protocol === "https:" &&
      (u.hostname === "images.unsplash.com" ||
        u.hostname === "images.pexels.com" ||
        u.hostname.endsWith(".public.blob.vercel-storage.com") ||
        u.hostname.endsWith(".supabase.co"))
    );
  } catch {
    return false;
  }
}

export async function PUT(req: Request) {
  const limit = rateLimit(`live-menu:${clientIp(req)}`, 30, 10 * 60_000);
  if (!limit.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
  }
  const ids = parsed.data.items.map((i) => i.id);
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: "duplicate_id" }, { status: 400 });
  }

  let savedAt: string;
  try {
    savedAt = await saveLiveMenu(parsed.data.items);
  } catch {
    return NextResponse.json({ error: "save_failed" }, { status: 502 });
  }
  // /menu is cached; rebuild it now so customers see the edit straight away.
  revalidateTag(MENU_TAG);
  revalidatePath("/menu");
  revalidatePath("/");
  return NextResponse.json({ ok: true, count: ids.length, savedAt });
}

/** Lets the admin screen check a password before showing the editor. */
export async function POST(req: Request) {
  const limit = rateLimit(`live-menu:${clientIp(req)}`, 30, 10 * 60_000);
  if (!limit.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  return isAdmin(req)
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
