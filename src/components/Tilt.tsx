"use client";

import { useEffect, useRef, type ReactNode, type PointerEvent } from "react";
import clsx from "clsx";

/**
 * 3D tilt with a specular highlight that tracks the light source.
 *
 * The effect exists on every device, not just desktop. What changes is the
 * input that drives it, because a phone has no cursor to tilt toward:
 *
 *   mouse  the card tilts toward the pointer and the highlight follows it
 *   touch  the card tilts with its own travel through the viewport, so
 *          scrolling rocks the cards like objects on a moving surface, and
 *          the highlight sweeps as they pass
 *
 * Both write custom properties onto the element itself and let the compositor
 * do the transform. Neither sets anything on a parent, which would restyle
 * every child on each frame. The touch path is a scroll-driven CSS animation
 * where the browser supports one, so it costs no main-thread work at all.
 */
export default function Tilt({
  children,
  className,
  maxDeg = 6,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  maxDeg?: number;
  as?: "div" | "article" | "li";
}) {
  const ref = useRef<HTMLElement>(null);

  /* ---- touch / coarse pointer: tilt driven by scroll position ----------- */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === "undefined") return;

    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (fine || reduced) return;

    // Where the browser has scroll-driven animations, hand the whole thing to
    // CSS: the card rocks as it crosses the viewport with zero JS per frame.
    if (CSS.supports("animation-timeline: view()")) {
      el.dataset.tiltScroll = "";
      return;
    }

    // Fallback: recompute on scroll, rAF-batched, one write per frame.
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const centre = r.top + r.height / 2;
      // -1 at the top of the viewport, +1 at the bottom.
      const progress = (centre / window.innerHeight) * 2 - 1;
      const clamped = Math.max(-1, Math.min(1, progress));
      el.style.setProperty("--rx", `${-clamped * maxDeg * 0.6}deg`);
      el.style.setProperty("--gy", `${50 + clamped * 40}%`);
      el.style.setProperty("--glint", "0.7");
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [maxDeg]);

  /* ---- mouse: tilt toward the cursor ------------------------------------ */
  const onMove = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--ry", `${(px - 0.5) * 2 * maxDeg}deg`);
    el.style.setProperty("--rx", `${(0.5 - py) * 2 * maxDeg}deg`);
    el.style.setProperty("--gx", `${px * 100}%`);
    el.style.setProperty("--gy", `${py * 100}%`);
    el.style.setProperty("--glint", "1");
    el.setAttribute("data-active", "");
  };

  const onLeave = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--glint", "0");
    el.removeAttribute("data-active");
  };

  const Comp = Tag as "div";
  return (
    <Comp
      ref={ref as never}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onPointerCancel={onLeave}
      className={clsx("tilt relative", className)}
    >
      {children}
      <span aria-hidden="true" className="tilt-glint" />
    </Comp>
  );
}
