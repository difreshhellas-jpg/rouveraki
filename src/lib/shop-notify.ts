"use client";

/**
 * System notifications for the shop screen. A notification plays the
 * device's own alert sound and shows on the lock screen, so a new order still
 * gets through when music is playing or the screen is off.
 *
 * Android/desktop: works in the browser once allowed. iPhone/iPad: only when
 * the shop screen was added to the Home Screen (iOS 16.4+), which is why the
 * shop screen installs as its own app ("Παραγγελίες").
 */
export const notificationsSupported = (): boolean =>
  typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;

export const notificationPermission = (): NotificationPermission | "unsupported" =>
  notificationsSupported() ? Notification.permission : "unsupported";

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!notificationsSupported()) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (!existing) await navigator.serviceWorker.register("/sw.js");
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

export async function enableShopNotifications(): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  const p = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (p === "granted") void registration();
  return p;
}

export async function notifyNewOrder(code: string, body: string): Promise<void> {
  if (notificationPermission() !== "granted") return;
  const reg = await registration();
  if (!reg) return;
  try {
    await reg.showNotification(`Νέα παραγγελία ${code}`, {
      body,
      tag: `order-${code}`,
      requireInteraction: true,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: "/demo-kitchen" },
      // Not in the TS lib types for every target, but honoured on Android.
      ...({ renotify: true, vibrate: [300, 120, 300, 120, 300] } as object),
    });
  } catch {
    /* notification blocked or unsupported here: the bell still rings */
  }
}
