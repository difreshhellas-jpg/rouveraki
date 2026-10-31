"use client";

/**
 * The one door every client-side backend call goes through.
 *
 * Normal mode: a plain fetch() to the /api routes (Prisma + Supabase), exactly
 * as before. Demo mode (NEXT_PUBLIC_DEMO_MODE=true): the same URLs are answered
 * from the browser's localStorage by lib/demo/store.ts, so no server, database
 * or payment provider is involved. The real routes are untouched.
 */
import { DEMO_MODE } from "@/lib/demo/config";
import * as demo from "@/lib/demo/store";
import type { OrderStatus } from "@/lib/order-status";
import type { MenuItemDTO } from "@/lib/menu-types";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const fail = (r: { error: string; extra?: object }) => {
  const status = r.error === "not_found" ? 404 : r.error === "stale_state" ? 409 : 400;
  return json({ error: r.error, ...r.extra }, status);
};

async function demoFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const path = url.split("?")[0];
  const query = new URLSearchParams(url.split("?")[1] ?? "");
  const body = (): Record<string, unknown> => {
    try {
      return JSON.parse(String(init.body ?? "{}"));
    } catch {
      return {};
    }
  };

  if (path === "/api/orders" && method === "POST") {
    // Priced against the live menu, so the owner's latest prices and sold-out
    // switches apply even if this tab loaded the menu a while ago.
    const menuRes = await fetch("/api/live-menu", { cache: "no-store" });
    if (!menuRes.ok) return json({ error: "menu_unavailable" }, 503);
    const { items } = (await menuRes.json()) as { items: MenuItemDTO[] };
    const r = demo.placeOrder(body() as unknown as demo.PlaceInput, items);
    return r.ok ? json(r.data) : fail(r);
  }

  let m = path.match(/^\/api\/orders\/([^/]+)\/cancel$/);
  if (m && method === "POST") {
    const r = demo.cancelByCustomer(decodeURIComponent(m[1]));
    return r.ok ? json({ ok: true }) : fail(r);
  }

  m = path.match(/^\/api\/orders\/([^/]+)$/);
  if (m && method === "GET") {
    const order = demo.getTracked(decodeURIComponent(m[1]));
    return order ? json({ order }) : json({ error: "not_found" }, 404);
  }

  if (path === "/api/admin/orders" && method === "GET") {
    const view = query.get("view") === "all" ? "all" : "live";
    return json({ orders: demo.listAdmin(view) });
  }

  m = path.match(/^\/api\/admin\/orders\/(\d+)\/transition$/);
  if (m && method === "POST") {
    const b = body();
    const r = demo.transition(Number(m[1]), b.to as OrderStatus, {
      expectedFrom: b.expectedFrom as OrderStatus | undefined,
      etaMinutes: b.etaMinutes as number | undefined,
      reasonText: b.reasonText as string | undefined,
    });
    return r.ok ? json({ ok: true }) : fail(r);
  }

  // Contact form: accepted and dropped. Nothing is sent anywhere in demo mode.
  if (path === "/api/contact" && method === "POST") return json({ ok: true });

  return json({ error: "not_available_in_demo" }, 404);
}

export function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  return DEMO_MODE ? demoFetch(url, init) : fetch(url, init);
}
