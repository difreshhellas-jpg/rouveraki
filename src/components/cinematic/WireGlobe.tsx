"use client";

import { useEffect, useRef } from "react";

/**
 * Slowly rotating wireframe icosahedron behind the hero copy. Atmosphere, not
 * a centrepiece: sparse, gold, and barely there.
 *
 * Hand-rolled 2D canvas rather than Three.js. Three would be roughly 150 kB
 * gzipped to draw thirty lines, on a site whose whole first-load budget is
 * 150 kB; this is about 2 kB and looks identical at this opacity. If the
 * geometry ever needs lighting, materials or a loaded model, that is the point
 * to reach for a real 3D library.
 *
 * Stops when the tab is hidden or the hero scrolls away, so it is never
 * burning a frame budget nobody is looking at.
 */

const PHI = (1 + Math.sqrt(5)) / 2;

/** Twelve icosahedron vertices, from three orthogonal golden rectangles. */
const VERTS: [number, number, number][] = [];
for (const s1 of [-1, 1]) {
  for (const s2 of [-1, 1]) {
    VERTS.push([0, s1, s2 * PHI], [s1, s2 * PHI, 0], [s2 * PHI, 0, s1]);
  }
}

/** Edge length for this construction is 2; pair up every vertex at that gap. */
const EDGES: [number, number][] = [];
for (let i = 0; i < VERTS.length; i++) {
  for (let j = i + 1; j < VERTS.length; j++) {
    const [ax, ay, az] = VERTS[i];
    const [bx, by, bz] = VERTS[j];
    const d = Math.hypot(ax - bx, ay - by, az - bz);
    if (Math.abs(d - 2) < 0.001) EDGES.push([i, j]);
  }
}

export default function WireGlobe({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let running = true;
    let onScreen = true;
    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    // Read the brand accent once so the colour follows the theme rather than
    // being hardcoded here.
    const accent =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--accent-bright-rgb")
        .trim() || "224 180 88";

    let t = 0;
    const draw = () => {
      raf = 0;
      if (!running || !onScreen) return;

      t += 0.0016;
      const radius = Math.min(w, h) * 0.34;
      const cx = w / 2;
      const cy = h / 2;

      const cosY = Math.cos(t);
      const sinY = Math.sin(t);
      const cosX = Math.cos(t * 0.42);
      const sinX = Math.sin(t * 0.42);

      const projected = VERTS.map(([x, y, z]) => {
        // rotate Y, then X
        const x1 = x * cosY + z * sinY;
        const z1 = -x * sinY + z * cosY;
        const y2 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;
        // perspective: nearer vertices spread wider and draw brighter
        const depth = 1 / (1 + (z2 / PHI) * 0.22);
        return {
          x: cx + (x1 / PHI) * radius * depth,
          y: cy + (y2 / PHI) * radius * depth,
          depth,
        };
      });

      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      for (const [a, b] of EDGES) {
        const p = projected[a];
        const q = projected[b];
        // Fade edges that sit at the back, so the solid reads as a volume
        // rather than a flat tangle of lines.
        const near = (p.depth + q.depth) / 2;
        ctx.strokeStyle = `rgb(${accent} / ${(near - 0.78) * 1.35})`;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.stroke();
      }

      raf = requestAnimationFrame(draw);
    };

    const start = () => {
      if (!raf && running && onScreen) raf = requestAnimationFrame(draw);
    };

    // Pause when the hero leaves the viewport or the tab is backgrounded.
    const io = new IntersectionObserver(
      ([e]) => {
        onScreen = e.isIntersecting;
        if (onScreen) {
          start();
        } else if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    const onVisibility = () => {
      running = !document.hidden;
      if (running) start();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onResize = () => {
      resize();
      start();
    };
    window.addEventListener("resize", onResize, { passive: true });

    start();

    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // size-full is not optional: a canvas is a replaced element with an
  // intrinsic 300x150, and `position:absolute; inset:0` alone will not stretch
  // it the way it stretches a div.
  return (
    <canvas ref={ref} aria-hidden="true" className={`size-full ${className ?? ""}`} />
  );
}
