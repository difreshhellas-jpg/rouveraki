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

export type InstallMode = "prompt" | "ios" | "none";

export function installMode(): InstallMode {
  if (typeof window === "undefined" || isStandalone()) return "none";
  if (deferred) return "prompt";
  if (isIOS()) return "ios";
  return "none";
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
