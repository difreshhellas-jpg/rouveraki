import { loadOfferImage } from "@/lib/offers-store";

/** Serves an uploaded offer photo. Each upload gets a new URL, so it can be cached for good. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const img = await loadOfferImage((await params).id).catch(() => null);
  if (!img) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(new Uint8Array(img.bytes), {
    headers: {
      "Content-Type": img.type,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
