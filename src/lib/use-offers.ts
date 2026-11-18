"use client";

import { useEffect, useState } from "react";
import type { PublicOffer } from "@/lib/offer-types";

export type OffersData = { offers: PublicOffer[]; pushKey: string | null };

/** Shared by every offers component; fetched again after a minute (pages are client-side navigations). */
let pending: Promise<OffersData> | null = null;
let fetchedAt = 0;
const load = () => {
  if (!pending || Date.now() - fetchedAt > 60_000) {
    fetchedAt = Date.now();
    pending = fetch("/api/offers")
      .then((r) => (r.ok ? (r.json() as Promise<OffersData>) : { offers: [], pushKey: null }))
      .catch(() => ({ offers: [], pushKey: null }));
  }
  return pending;
};

/** The offers customers see now; null while loading. */
export function useOffers(): OffersData | null {
  const [data, setData] = useState<OffersData | null>(null);
  useEffect(() => {
    let live = true;
    void load().then((d) => live && setData(d));
    return () => {
      live = false;
    };
  }, []);
  return data;
}

/* ---- offer notifications (Web Push) --------------------------------------- */
export type PushState = "unsupported" | "ios-install" | "denied" | "off" | "on";

const supported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

async function registration() {
  if (!(await navigator.serviceWorker.getRegistration())) await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

export async function pushState(): Promise<PushState> {
  // iPhone/iPad only allow push for a site added to the Home Screen.
  if (typeof window !== "undefined" && isIOS() && !standalone()) return "ios-install";
  if (!supported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    return sub && Notification.permission === "granted" ? "on" : "off";
  } catch {
    return "off";
  }
}

const keyBytes = (base64url: string) => {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};

/** Asks permission (only from a tap) and signs this device up. */
export async function turnOnOfferPush(pushKey: string): Promise<PushState> {
  if (!supported()) return "unsupported";
  const p = await Notification.requestPermission();
  if (p !== "granted") return p === "denied" ? "denied" : "off";
  const reg = await registration();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(pushKey) }));
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
  return res.ok ? "on" : "off";
}

export async function turnOffOfferPush(): Promise<PushState> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {});
      await sub.unsubscribe();
    }
  } catch {
    /* nothing to undo */
  }
  return "off";
}
