"use client";

/**
 * The owner's password (ADMIN_PASSWORD), remembered on this device (so the
 * installed shop app does not ask on every launch) and sent as `x-admin-key`
 * to the shop and menu APIs. A wrong or changed password is asked again.
 */
export const ADMIN_KEY_STORE = "rouveraki.admin-key";

export const readAdminKey = (): string => {
  try {
    return localStorage.getItem(ADMIN_KEY_STORE) ?? sessionStorage.getItem(ADMIN_KEY_STORE) ?? "";
  } catch {
    return "";
  }
};

export const writeAdminKey = (key: string | null) => {
  try {
    if (key) localStorage.setItem(ADMIN_KEY_STORE, key);
    else {
      localStorage.removeItem(ADMIN_KEY_STORE);
      sessionStorage.removeItem(ADMIN_KEY_STORE);
    }
  } catch {
    /* private mode: the password is simply asked again */
  }
};

/** True when the server accepts this password. */
export async function checkAdminKey(key: string): Promise<boolean> {
  if (!key) return false;
  const res = await fetch("/api/live-menu", { method: "POST", headers: { "x-admin-key": key } });
  return res.ok;
}
