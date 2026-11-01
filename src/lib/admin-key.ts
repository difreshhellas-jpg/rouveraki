"use client";

/**
 * The owner's password (ADMIN_PASSWORD), kept for this browser tab only and
 * sent as `x-admin-key` to the shop and menu APIs.
 */
export const ADMIN_KEY_STORE = "rouveraki.admin-key";

export const readAdminKey = (): string => {
  try {
    return sessionStorage.getItem(ADMIN_KEY_STORE) ?? "";
  } catch {
    return "";
  }
};

export const writeAdminKey = (key: string | null) => {
  try {
    if (key) sessionStorage.setItem(ADMIN_KEY_STORE, key);
    else sessionStorage.removeItem(ADMIN_KEY_STORE);
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
