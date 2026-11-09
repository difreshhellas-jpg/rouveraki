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
  scroll = true,
}: {
  children: ReactNode;
  className?: string;
  maxDeg?: number;
  as?: "div" | "article" | "li";
  /** Rock with the scroll on touch screens. Off for long lists, where a
   *  scroll animation on every row costs more than it adds. */
  scroll?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);

  /* ---- touch / coarse pointer: tilt driven by scroll position ----------- */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === "undefined") return;

    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (fine || reduced || !scroll) return;

    // Where the browser has scroll-driven animations, hand the whole thing to
    // CSS: the card rocks as it crosses the viewport with zero JS per frame.
    if (CSS.supports("animation-timeline: view()")) {
      el.dataset.tiltScroll = "";
      return;
    }

    // Fallback (iOS before Safari 26): one shared scroll loop for every
    // card on the page, which measures only the cards on screen and does all
    // reads before all writes, so a long menu never forces layout per card.
    return watchScrollTilt(el, maxDeg);
  }, [maxDeg, scroll]);

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

/* ---- shared scroll-tilt loop for browsers without scroll timelines ------ */
const tilted = new Map<HTMLElement, number>();
const onScreen = new Set<HTMLElement>();
let io: IntersectionObserver | null = null;
let frame = 0;

function runTilt() {
  frame = 0;
  const vh = window.innerHeight;
  const reads: [HTMLElement, number][] = [];
  for (const el of onScreen) {
    const r = el.getBoundingClientRect();
    reads.push([el, Math.max(-1, Math.min(1, ((r.top + r.height / 2) / vh) * 2 - 1))]);
  }
  for (const [el, c] of reads) {
    const deg = tilted.get(el) ?? 6;
    el.style.setProperty("--rx", `${(-c * deg * 0.6).toFixed(2)}deg`);
    el.style.setProperty("--sweep", `${(20 * c).toFixed(1)}%`);
  }
}
const schedule = () => {
  if (!frame) frame = requestAnimationFrame(runTilt);
};

function watchScrollTilt(el: HTMLElement, maxDeg: number) {
  if (!io) {
    io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const t = e.target as HTMLElement;
          if (e.isIntersecting) onScreen.add(t);
          else onScreen.delete(t);
        }
        schedule();
      },
      { rootMargin: "10% 0px" },
    );
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
  }
  tilted.set(el, maxDeg);
  el.dataset.tiltJs = "";
  io.observe(el);
  return () => {
    tilted.delete(el);
    delete el.dataset.tiltJs;
    onScreen.delete(el);
    io?.unobserve(el);
  };
}
