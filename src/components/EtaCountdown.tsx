"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

/**
 * Live countdown to the time promised when the order was accepted
 * (etaConfirmedAt + etaMinutes). Past it, it counts up in red so the shop
 * sees how late an order is running.
 */
export default function EtaCountdown({
  etaMinutes,
  etaConfirmedAt,
  className,
  size = "sm",
  lateText,
}: {
  etaMinutes: number | null;
  etaConfirmedAt: string | null;
  className?: string;
  size?: "sm" | "lg";
  /** Customer-facing: shown instead of a red "+m:ss" once the time is up. */
  lateText?: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!etaMinutes || !etaConfirmedAt) return null;
  const due = new Date(etaConfirmedAt).getTime() + etaMinutes * 60_000;
  const left = Math.round((due - now) / 1000);
  const late = left < 0;
  const s = Math.abs(left);
  const text =
    late && lateText ? lateText : `${late ? "+" : ""}${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <span
      role="timer"
      aria-label={late ? `Καθυστέρηση ${Math.ceil(s / 60)} λεπτά` : `Απομένουν ${Math.ceil(s / 60)} λεπτά`}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full font-bold tabular-nums",
        size === "lg" ? "px-4 py-1.5 text-2xl" : "px-2.5 py-0.5 text-sm",
        late && lateText ? "bg-gold/25 text-char" : late ? "bg-rust text-onrust" : left < 300 ? "bg-gold/25 text-char" : "bg-emerald-600/15 text-emerald-800",
        className,
      )}
    >
      <svg aria-hidden viewBox="0 0 24 24" className={size === "lg" ? "size-6" : "size-4"} fill="none" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2.5M9 2h6" />
      </svg>
      {text}
    </span>
  );
}
