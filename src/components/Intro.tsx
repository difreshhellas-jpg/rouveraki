"use client";

import { useEffect, useState } from "react";
import { BRAND } from "@/lib/brand";

const SESSION_KEY = "rouveraki.intro.seen";
const DURATION_MS = 2000;

/**
 * Two second wordmark on first load.
 *
 * Rare, first-impression moments are the one place the frequency table allows
 * real delight, so this exists. Three rules keep it from becoming an obstacle:
 *
 *  - it never blocks input (pointer-events: none for its whole life)
 *  - it unmounts when finished, so it cannot trap focus or catch clicks
 *  - it plays once per tab session, because an arrival you have already seen
 *    is just a wait
 *
 * Pure CSS keyframes rather than JS: this is predetermined motion on the
 * busiest frame of the page load, and CSS animations run off the main thread
 * while React is still hydrating.
 *
 * prefers-reduced-motion hides it entirely (globals.css) — it is decoration,
 * and the reduced-motion rule is "gentler", which for pure decoration is none.
 */
export default function Intro() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let seen = true;
    try {
      seen = sessionStorage.getItem(SESSION_KEY) === "1";
    } catch {
      // Private mode or blocked storage: skip rather than replay every render.
    }
    if (seen) return;

    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      /* non-fatal */
    }

    setShow(true);
    const id = window.setTimeout(() => setShow(false), DURATION_MS);
    return () => window.clearTimeout(id);
  }, []);

  if (!show) return null;

  return (
    <div data-intro="" aria-hidden="true">
      <div className="flex flex-col items-center px-6">
        <span
          data-intro-mark=""
          className="font-display text-[clamp(2rem,9vw,3.5rem)] font-bold tracking-tight text-char"
        >
          {BRAND.nameEl}
        </span>
        <span data-intro-rule="" className="tex-rope mt-4 w-24" />
      </div>
    </div>
  );
}
