"use client";

import { useEffect } from "react";
import "@/motion/motion-base.css";
import "@/motion/hero.css";
import "@/motion/scroll.css";
import "@/motion/cursor.css";
import "@/motion/navigation.css";
import "@/motion/theme.css";

type MotionApi = { teardown: () => void; boot: () => void; refresh: () => void };
declare global {
  interface Window { Motion?: MotionApi }
}

/**
 * Boots the luxury-web-animations engine (src/motion, copied from the skill)
 * on the homepage only.
 *
 * The engine reads GSAP, its plugins and Lenis from window globals, the way it
 * expects to be loaded from a CDN. The site's CSP forbids CDN scripts, so they
 * come from npm, are assigned to window here, and only then is the engine
 * imported. Every import is dynamic: none of it counts toward first-load JS,
 * and Three.js arrives last in its own chunk.
 *
 * Unmount tears every effect and the smooth scroll down; coming back re-boots
 * against the new DOM. Without that, client navigation would leave Lenis
 * hijacking the wheel on /menu, where the drawer sheets need native scroll.
 */
/** Read through a call so TypeScript does not carry an earlier narrowing across awaits. */
const motion = (): MotionApi | undefined => window.Motion;

export default function MotionEngine() {
  useEffect(() => {
    let alive = true;
    (async () => {
      const existing = motion();
      if (existing) {
        existing.boot();
        return;
      }
      const [{ gsap }, { ScrollTrigger }, { SplitText }, { CustomEase }, { default: Lenis }] =
        await Promise.all([
          import("gsap"),
          import("gsap/ScrollTrigger"),
          import("gsap/SplitText"),
          import("gsap/CustomEase"),
          import("lenis"),
        ]);
      if (!alive) return;
      Object.assign(window, { gsap, ScrollTrigger, SplitText, CustomEase, Lenis });
      await import("@/motion/motion-core.js");
      await Promise.all([
        import("@/motion/hero.js"),
        import("@/motion/scroll.js"),
        import("@/motion/cursor.js"),
        import("@/motion/navigation.js"),
      ]);
      await import("@/motion/three-hero.js");
      if (!alive) motion()?.teardown();
    })();
    return () => {
      alive = false;
      motion()?.teardown();
    };
  }, []);

  // Ribbon trail: fine pointers only, enforced by the engine.
  return <canvas data-fx="ribbon-trail" data-width="8" data-life="420" aria-hidden="true" />;
}
