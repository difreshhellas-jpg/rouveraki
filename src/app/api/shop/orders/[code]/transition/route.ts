import { NextResponse } from "next/server";
import { z } from "zod";
import { ORDER_STATUSES } from "@/lib/order-status";
import { isAdmin } from "@/lib/menu-store";
import { transition } from "@/lib/order-store";
import { REJECTION_REASONS } from "@/lib/brand";

const Body = z.object({
  to: z.enum(ORDER_STATUSES),
  expectedFrom: z.enum(ORDER_STATUSES).optional(),
  etaMinutes: z.number().optional(),
  reasonId: z.string().max(60).optional(),
  reasonText: z.string().max(300).optional(),
});

/** The shop moves an order along (accept, preparing, ready, ...). Password required. */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const { to, reasonId, reasonText, ...extra } = parsed.data;
  // The customer sees the chosen reason, plus any details the shop typed.
  const label = REJECTION_REASONS.find((r) => r.id === reasonId)?.el;
  const reason = [label, reasonText?.trim()].filter(Boolean).join(" - ") || undefined;
  const r = await transition((await params).code, to, { ...extra, reasonText: reason });
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status ?? 400 });
}
