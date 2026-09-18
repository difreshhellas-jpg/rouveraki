"use client";

import { useRef, type ReactNode, type PointerEvent } from "react";
import clsx from "clsx";

/**
 * CSS 3D tilt. The card rotates a few degrees toward the pointer and a soft
 * specular highlight tracks it, so it reads as a physical object under a
 * light rather than a flat rectangle.
 *
 * Everything is set as custom properties on the element itself (never on a
 * parent, which would recalc styles for every child) and the browser does the
 * transform. Only activates for a fine pointer: on touch there is no cursor to
 * tilt toward and it would fight the scroll. Reduced motion disables the
 * transform in globals.css and keeps only the shadow change.
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

  const onMove = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;   // 0..1
    const py = (e.clientY - r.top) / r.height;   // 0..1
    // Tilt toward the pointer: right half tilts right, top half tilts back.
    el.style.setProperty("--ry", `${(px - 0.5) * 2 * maxDeg}deg`);
    el.style.setProperty("--rx", `${(0.5 - py) * 2 * maxDeg}deg`);
    el.style.setProperty("--gx", `${px * 100}%`);
    el.style.setProperty("--gy", `${py * 100}%`);
    el.style.setProperty("--glint", "1");
    el.setAttribute("data-active", "");
  };

  const onLeave = () => {
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
