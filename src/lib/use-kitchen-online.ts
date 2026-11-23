"use client";

import { useEffect, useState } from "react";

/**
 * Customer side of the shop-app switch: true while the shop's app is open,
 * false when it is closed, null until the first answer arrives (treated as
 * open so the page does not flash a closed notice on every load).
 */
export function useKitchenOnline(): boolean | null {
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    let dead = false;
    const read = () =>
      fetch("/api/shop/status")
        .then((r) => r.json() as Promise<{ kitchenOnline: boolean }>)
        .then((b) => !dead && setOnline(b.kitchenOnline))
        .catch(() => {});
    void read();
    const id = window.setInterval(read, 15_000);
    const onVisible = () => document.visibilityState === "visible" && void read();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      dead = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return online;
}
