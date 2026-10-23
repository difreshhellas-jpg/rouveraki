"use client";

import { useEffect, useState } from "react";
import { BRAND } from "@/lib/brand";

const SESSION_KEY = "rouveraki.intro.seen";
/** Keep in sync with the last keyframe end in globals.css (intro section). */
const DURATION_MS = 3000;

/** Deterministic embers: no Math.random, so server and client markup match. */
const EMBERS = Array.from({ length: 18 }, (_, i) => ({
  x: ((i * 37) % 100) - 50,
  d: 260 + ((i * 131) % 900),
  s: 2 + ((i * 7) % 4),
  h: 140 + ((i * 53) % 190),
}));

/**
 * First-arrival film: a gold horizon draws across the dark, the wordmark rises
 * out of it letter by letter under a rain of embers from the grill, then the
 * horizon is the seam the screen splits along to reveal the page.
 *
 *  - It is server-rendered and starts on CSS time, so it covers the hero from
 *    the very first paint instead of popping in after hydration.
 *  - A tiny head script (layout.tsx) marks returning visitors before paint, so
 *    they never see it. Plays once per tab session.
 *  - It never takes input: pointer-events are off for its whole life and it is
 *    removed when finished, so it cannot trap focus or catch clicks.
 *  - prefers-reduced-motion hides it entirely (globals.css).
 *
 * Pure CSS keyframes: predetermined motion on the busiest frame of the load,
 * running off the main thread while React hydrates.
 */
export default function Intro() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SESSION_KEY) === "1";
      if (!seen) sessionStorage.setItem(SESSION_KEY, "1");
    } catch {
      // Blocked storage: play it once for this mount rather than replaying.
    }
    if (seen) {
      setShow(false);
      return;
    }
    const id = window.setTimeout(() => setShow(false), DURATION_MS + 80);
    return () => window.clearTimeout(id);
  }, []);

  if (!show) return null;

  const letters = Array.from(BRAND.nameEl);

  return (
    <div data-intro="" aria-hidden="true">
      <div data-intro-panel="top" />
      <div data-intro-panel="bottom" />
      <div data-intro-line="" />

      <div data-intro-stage="">
        <div data-intro-word="" className="font-display">
          {letters.map((ch, i) => (
            <span key={i} data-intro-ch="" style={{ ["--i" as string]: i }}>
              <span>{ch}</span>
            </span>
          ))}
        </div>
        <p data-intro-sub="">
          {BRAND.address.city} <i /> Μαρίνα
        </p>
        {EMBERS.map((e, i) => (
          <span
            key={i}
            data-intro-ember=""
            style={{
              ["--x" as string]: `${e.x}%`,
              ["--d" as string]: `${e.d}ms`,
              ["--s" as string]: `${e.s}px`,
              ["--h" as string]: `${e.h}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
