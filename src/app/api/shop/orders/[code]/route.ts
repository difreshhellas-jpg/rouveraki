import { NextResponse } from "next/server";
import { isOrderCodeShape } from "@/lib/order-code";
import { getTracked } from "@/lib/order-store";

export const dynamic = "force-dynamic";

/** The customer's tracking view of one order: no phone, no address. */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!isOrderCodeShape(code.toUpperCase())) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const order = await getTracked(code).catch(() => null);
  return order ? NextResponse.json({ order }) : NextResponse.json({ error: "not_found" }, { status: 404 });
}
