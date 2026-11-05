import "server-only";
import { timingSafeEqual } from "node:crypto";
import { hasKv, kvGet, kvSet } from "@/lib/kv";
import bundled from "@/data/menu.json";
import { CATEGORIES } from "@/lib/brand";
import type { MenuItemDTO } from "@/lib/menu-types";

/**
 * The live menu for demo mode, shared by every visitor.
 *
 * The owner edits it from /demo-kitchen/menu and it is saved as one JSON file
 * in the project's Vercel Blob store. Until the first save (or with no Blob
 * token, e.g. local dev) the menu bundled in src/data/menu.json is served.
 */
const MENU_KEY = "menu:doc";

const order = new Map<string, number>(CATEGORIES.map((c, i) => [c.slug, i]));
const byCategory = (items: MenuItemDTO[]) =>
  [...items].sort((a, b) => (order.get(a.category) ?? 999) - (order.get(b.category) ?? 999));

/**
 * `strict` throws when a saved menu exists but cannot be read, instead of
 * quietly serving the bundled one. The API uses it: the owner's screen saves
 * the whole list back, so editing a fallback copy would wipe every earlier
 * change, and orders must not be priced from stale data either.
 */
export type MenuDoc = { items: MenuItemDTO[]; savedAt: string | null };

export async function loadLiveMenu({ strict = false } = {}): Promise<MenuItemDTO[]> {
  return (await loadLiveMenuDoc({ strict })).items;
}

/**
 * Note: right after an overwrite, Blob can still return the previous version
 * for a few seconds (measured 4-7 s). `savedAt` lets the owner's screen tell
 * an older copy from its own newer save.
 */
export async function loadLiveMenuDoc({ strict = false } = {}): Promise<MenuDoc> {
  if (hasKv()) {
    try {
      const data = await kvGet<{ items: MenuItemDTO[]; savedAt?: string }>(MENU_KEY);
      // Nothing saved yet is normal: serve the bundled menu.
      if (data) return { items: byCategory(data.items), savedAt: data.savedAt ?? null };
    } catch (err) {
      // A read failure the strict callers must not paper over.
      if (strict) throw err;
    }
  }
  return { items: byCategory(bundled.items as MenuItemDTO[]), savedAt: null };
}

export async function saveLiveMenu(items: MenuItemDTO[]): Promise<string> {
  if (!hasKv()) throw new Error("store_not_configured");
  const savedAt = new Date().toISOString();
  await kvSet(MENU_KEY, { items, savedAt });
  return savedAt;
}

/** Photo upload needs file storage; the free key-value store is not one. */
export async function saveMenuImage(): Promise<string> {
  throw new Error("image_upload_unavailable");
}

/** The owner's password, from ADMIN_PASSWORD in the Vercel project settings. */
export function isAdmin(req: Request): boolean {
  const expected = Buffer.from(process.env.ADMIN_PASSWORD ?? "");
  const given = Buffer.from(req.headers.get("x-admin-key") ?? "");
  if (!expected.length || given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}
