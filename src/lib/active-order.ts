"use client";

/**
 * The customer's order in progress, remembered on this device so they can leave
 * the order page, browse the site, and come straight back to it (ActiveOrderBar).
 * Cleared once the order is finished, or after ACTIVE_ORDER_HOURS anyway.
 */
const KEY = "rouveraki.active-order";
const EVENT = "rouveraki:active-order";
export const ACTIVE_ORDER_HOURS = 12;

export type ActiveOrder = { code: string; at: number };

export function saveActiveOrder(code: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() } satisfies ActiveOrder));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* storage blocked: the order page itself still works */
  }
}

export function readActiveOrder(): ActiveOrder | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as ActiveOrder | null;
    if (!v || typeof v.code !== "string" || typeof v.at !== "number") return null;
    if (Date.now() - v.at > ACTIVE_ORDER_HOURS * 3600_000) {
      localStorage.removeItem(KEY);
      return null;
    }
    return v;
  } catch {
    return null;
  }
}

export function clearActiveOrder(code?: string): void {
  try {
    if (code && readActiveOrder()?.code !== code) return;
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore */
  }
}

export function onActiveOrderChange(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", fn);
  };
}
