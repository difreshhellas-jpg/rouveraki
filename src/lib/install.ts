"use client";

/**
 * "Install the app" support, shared by every install button on the site.
 *
 * Android / desktop Chrome and Edge fire `beforeinstallprompt` once, early, so
 * it is caught here at module load and kept for whichever button is tapped.
 * iPhone and iPad have no install API: Safari can only add a site to the Home
 * Screen from its Share menu, so the button shows those two steps instead.
 */
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: BIPEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BIPEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
  if ("serviceWorker" in navigator) {
    const register = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }
}

export const subscribeInstall = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Instagram / Facebook / Messenger in-app browsers cannot add to Home Screen. */
export function isInAppBrowser(): boolean {
  return /FBAN|FBAV|Instagram|Messenger|Line\//i.test(navigator.userAgent);
}

/** A computer (mouse/trackpad), as opposed to a phone or tablet. */
export function isDesktop(): boolean {
  return window.matchMedia("(pointer: fine)").matches && !isIOS() && !/Android/i.test(navigator.userAgent);
}

/** Which manual steps to show when the browser has no one-tap install. */
export function manualKind(): "safari-mac" | "chromium" | "firefox" | "android" {
  const ua = navigator.userAgent;
  if (ua.includes("Firefox/")) return "firefox";
  if (/Android/i.test(ua)) return "android";
  if (ua.includes("Safari/") && !/Chrome|Chromium|Edg/.test(ua)) return "safari-mac";
  return "chromium";
}

/**
 * "prompt": the browser's own one-tap install (Chrome/Edge on Android and on
 * computers). "ios": the two Safari steps. "manual": any other browser, shown
 * where its own install command lives. "none": already running as the app.
 */
export type InstallMode = "prompt" | "ios" | "manual" | "none";

export function installMode(): InstallMode {
  if (typeof window === "undefined" || isStandalone()) return "none";
  if (deferred) return "prompt";
  if (isIOS()) return "ios";
  return "manual";
}

/** Shows the browser's own install dialog. Returns true when the user accepted. */
export async function promptInstall(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  await e.prompt();
  const { outcome } = await e.userChoice;
  deferred = null;
  notify();
  return outcome === "accepted";
}
