import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { isAdmin } from "@/lib/menu-store";
import { runDue } from "@/lib/notify-schedule";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * Sends the scheduled notifications that are due. Called every few minutes by
 * an outside pinger (cron-job.org) as
 *   https://rouveraki.com/api/notifications/run?key=CRON_SECRET
 * or by a Vercel cron (Authorization: Bearer CRON_SECRET), and by the shop app
 * while it is open (x-admin-key).
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET?.trim() ?? "";
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const key = new URL(req.url).searchParams.get("key") ?? "";
  const ok = (secret && (same(bearer, secret) || same(key, secret))) || isAdmin(req);
  if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await runDue()) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "store_unavailable" }, { status: 503 });
  }
}

export const GET = handle;
export const POST = handle;
