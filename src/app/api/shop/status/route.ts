import { NextResponse } from "next/server";
import { isKitchenOnline } from "@/lib/kitchen-presence";

export const dynamic = "force-dynamic";

/** Public: is delivery available right now (the shop app is open)? */
export async function GET() {
  return NextResponse.json(
    { kitchenOnline: await isKitchenOnline() },
    // Shared for 5 s at the edge so every visitor does not hit the store.
    { headers: { "Cache-Control": "public, s-maxage=5" } },
  );
}
