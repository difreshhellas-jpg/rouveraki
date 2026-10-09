"use client";

import { useEffect, useRef } from "react";

/**
 * Soft gold trail following the cursor.
 *
 * Mouse only, and deliberately so: a trail is defined by cursor movement, and
 * a phone has no cursor. There is nothing to substitute, so touch simply does
 * not get it. (Contrast with the card tilt, where the same effect genuinely
 * can be driven by scroll instead.)
 *
 * Three things keep it from being a tax on every frame of every page:
 *   - the loop only runs while points are alive, and stops itself when the
 *     trail has faded, so an idle cursor costs nothing
 *   - the point buffer is capped, so a fast sweep cannot grow it without bound
 *   - it is homepage-only, mounted below the hero's own z-index so it never
 *     sits over a dialog or the cart bar
 *
 * Not a custom cursor: the real pointer is untouched, which keeps the whole
 * thing out of the way of usability.
 */

type Point = { x: number; y: number; life: number };

const MAX_POINTS = 26;
const DECAY = 0.045;

export default function CursorTrail() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const accent =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--accent-bright-rgb")
        .trim() || "240 200 110";

    let points: Point[] = [];
    let raf = 0;

    const render = () => {
      raf = 0;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (const p of points) {
        // A soft radial dot rather than a hard circle: at this size a flat
        // disc reads as a cursor artefact, a gradient reads as light.
        const r = 26 * p.life;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, `rgb(${accent} / ${p.life * 0.4})`);
        g.addColorStop(1, `rgb(${accent} / 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        p.life -= DECAY;
      }

      points = points.filter((p) => p.life > 0);
      // Stop the loop entirely once the trail is gone. It restarts on the next
      // pointer move, so a still cursor costs zero frames.
      if (points.length) raf = requestAnimationFrame(render);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      points.push({ x: e.clientX, y: e.clientY, life: 1 });
      if (points.length > MAX_POINTS) points.splice(0, points.length - MAX_POINTS);
      if (!raf) raf = requestAnimationFrame(render);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("resize", resize, { passive: true });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[45]"
    />
  );
}
