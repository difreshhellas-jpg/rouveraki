"use client";

import { useRef, type ReactNode, type PointerEvent } from "react";
import clsx from "clsx";

/**
 * Magnetic hover: the element drifts toward the cursor as it approaches.
 *
 * Two details separate this from the usual version:
 *
 *  - the pull eases off toward the edges rather than tracking the cursor 1:1,
 *    so the element settles instead of twitching under a fast mouse
 *  - the transform is written straight onto the element, never through a
 *    custom property on a parent, which would restyle every child each frame
 *
 * Mouse only. The effect is defined by cursor proximity, and there is no
 * cursor on touch, so there is nothing to approximate: touch users get the
 * press feedback that every other button has. Reduced motion disables it.
 */
export default function Magnetic({
  children,
  className,
  strength = 0.3,
}: {
  children: ReactNode;
  className?: string;
  /** Fraction of the cursor's offset the element travels. 0.3 is subtle. */
  strength?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useRef<boolean | null>(null);

  const prefersReduced = () => {
    reduced.current ??= window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return reduced.current;
  };

  const onMove = (e: PointerEvent<HTMLSpanElement>) => {
    if (e.pointerType !== "mouse" || prefersReduced()) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    // Normalise to -1..1, then ease: the pull is strongest near the centre and
    // tapers at the edges, which is what stops the jitter.
    const nx = Math.max(-1, Math.min(1, dx / (r.width / 2)));
    const ny = Math.max(-1, Math.min(1, dy / (r.height / 2)));
    const ease = (v: number) => Math.sign(v) * (1 - (1 - Math.abs(v)) ** 2);
    el.style.transform = `translate3d(${ease(nx) * r.width * strength * 0.5}px, ${
      ease(ny) * r.height * strength * 0.5
    }px, 0)`;
  };

  const reset = () => {
    const el = ref.current;
    if (el) el.style.transform = "translate3d(0,0,0)";
  };

  return (
    <span
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      onPointerCancel={reset}
      className={clsx("inline-block will-change-transform", className)}
      style={{ transition: "transform 380ms cubic-bezier(0.23,1,0.32,1)" }}
    >
      {children}
    </span>
  );
}
