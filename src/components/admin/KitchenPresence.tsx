"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { readAdminKey } from "@/lib/admin-key";

/**
 * Keeps delivery open on the site while this shop app is open: a heartbeat
 * every 30 s (and at once when the screen comes back), plus a wake lock so the
 * tablet does not sleep and close delivery by accident. Shows the state in a
 * small pill so the staff can see that customers can order.
 */
export default function KitchenPresence() {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const beat = () =>
      fetch("/api/shop/heartbeat", { method: "POST", headers: { "x-admin-key": readAdminKey() } })
        .then((r) => setOk(r.ok))
        .catch(() => setOk(false));
    const wake = async () => {
      try {
        const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
        if (wl && document.visibilityState === "visible") lock = await wl.request("screen");
      } catch {
        /* not supported or refused: the screen may sleep */
      }
    };
    void beat();
    void wake();
    const id = window.setInterval(beat, 30_000);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void beat();
      void wake(); // the browser drops the wake lock whenever the page is hidden
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, []);

  if (ok === null) return null;
  return (
    // At the top of the page, in the flow: never floating over the screen's
    // buttons. Same plain background as the shop screens below it.
    <div className="bg-sand pt-3 print:hidden">
      <p
        role="status"
        className={clsx(
          "mx-auto w-fit rounded-full px-3 py-1.5 text-xs font-bold",
          ok ? "bg-emerald-600 text-white" : "bg-rust text-onrust",
        )}
      >
        {ok ? "● Διανομή ανοιχτή στο site" : "● Χωρίς σύνδεση: η διανομή κλείνει"}
      </p>
    </div>
  );
}
