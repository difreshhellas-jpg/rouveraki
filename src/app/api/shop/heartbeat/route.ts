import { NextResponse, after } from "next/server";
import { isAdmin } from "@/lib/menu-store";
import { markKitchenAlive } from "@/lib/kitchen-presence";
import { maybeRunDue } from "@/lib/notify-schedule";

export const dynamic = "force-dynamic";

/** The shop app's "I'm open" signal (password required). See lib/kitchen-presence.ts. */
export async function POST(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await markKitchenAlive();
    // Backup trigger for scheduled offer notifications while the shop app is open.
    after(maybeRunDue);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }
}
