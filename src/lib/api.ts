"use client";

/**
 * The one door every client-side backend call goes through.
 *
 * Normal mode: a plain fetch() to the /api routes (Prisma + Supabase), exactly
 * as before. Demo mode (NEXT_PUBLIC_DEMO_MODE=true): the same URLs are sent to
 * the /api/shop routes, which keep orders as files in Vercel Blob
 * (lib/order-store.ts). No database or payment provider is involved, and the
 * real routes are untouched.
 */
import { DEMO_MODE } from "@/lib/demo/config";
import { readAdminKey } from "@/lib/admin-key";
import { idToCode } from "@/lib/order-id";
import { nextStatuses, type OrderStatus } from "@/lib/order-status";

/** Status changes this tab made in the last minute, by order id. */
const recent = new Map<number, { from: string; to: string; until: number }>();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

async function demoFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const path = url.split("?")[0];
  const query = new URLSearchParams(url.split("?")[1] ?? "");

  // Orders live in the shared Blob store (/api/shop/*), so the shop sees
  // them from any device. Shop calls carry the owner's password.
  const admin = { "x-admin-key": readAdminKey() };
  const jsonHeaders = { "Content-Type": "application/json" };

  if (path === "/api/orders" && method === "POST") {
    return fetch("/api/shop/orders", { method: "POST", headers: jsonHeaders, body: init.body });
  }

  let m = path.match(/^\/api\/orders\/([^/]+)\/cancel$/);
  if (m && method === "POST") {
    return fetch(`/api/shop/orders/${m[1]}/cancel`, { method: "POST" });
  }

  m = path.match(/^\/api\/orders\/([^/]+)$/);
  if (m && method === "GET") {
    return fetch(`/api/shop/orders/${m[1]}`, { cache: "no-store" });
  }

  if (path === "/api/admin/orders" && method === "GET") {
    const view = query.get("view") === "all" ? "all" : "live";
    const res = await fetch(`/api/shop/orders?view=${view}`, { headers: admin, cache: "no-store" });
    if (!res.ok) return res;
    const data = (await res.json()) as { orders: { id: number; status: string; allowedNext: string[] }[] };
    // A status change takes a few seconds to show up in the store's listing;
    // until it does, show the change this screen just made, not the old state.
    const now = Date.now();
    for (const o of data.orders) {
      const mine = recent.get(o.id);
      if (mine && mine.until > now && o.status === mine.from) {
        o.status = mine.to;
        o.allowedNext = nextStatuses(mine.to as OrderStatus) as string[];
      }
    }
    return json(data);
  }

  m = path.match(/^\/api\/admin\/orders\/(\d+)\/transition$/);
  if (m && method === "POST") {
    const id = Number(m[1]);
    const res = await fetch(`/api/shop/orders/${idToCode(id)}/transition`, {
      method: "POST",
      headers: { ...jsonHeaders, ...admin },
      body: init.body,
    });
    if (res.ok) {
      const sent = JSON.parse(String(init.body ?? "{}")) as { to?: string; expectedFrom?: string };
      if (sent.to && sent.expectedFrom) {
        recent.set(id, { from: sent.expectedFrom, to: sent.to, until: Date.now() + 60_000 });
      }
    }
    return res;
  }

  // Contact form: accepted and dropped. Nothing is sent anywhere in demo mode.
  if (path === "/api/contact" && method === "POST") return json({ ok: true });

  return json({ error: "not_available_in_demo" }, 404);
}

export function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  return DEMO_MODE ? demoFetch(url, init) : fetch(url, init);
}
