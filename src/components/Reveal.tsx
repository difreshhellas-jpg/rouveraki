import type { ElementType, ReactNode } from "react";
import clsx from "clsx";

/**
 * Scroll reveal for marketing surfaces. Not used in admin.
 *
 * This is now a plain wrapper: the motion is a CSS scroll-driven animation
 * (`animation-timeline: view()` in globals.css) with no JavaScript in the
 * loop. The previous version hid content until an IntersectionObserver fired,
 * and when that observer did not fire the whole page below the hero was a
 * blank void. Content is visible by default now; browsers that support the
 * timeline animate it in, browsers that do not simply show it.
 *
 * `delayMs` maps to a slightly later animation range so siblings stagger.
 */
export default function Reveal({
  children,
  as: Tag = "div",
  delayMs = 0,
  className,
}: {
  children: ReactNode;
  as?: ElementType;
  delayMs?: number;
  className?: string;
}) {
  // 60ms of stagger ≈ 4% of the entry range; keeps siblings in the 30-80ms band.
  const shift = Math.min(24, Math.round(delayMs / 15));
  return (
    <Tag
      data-reveal=""
      className={clsx("reveal", className)}
      style={
        shift
          ? { animationRange: `entry ${shift}% entry ${38 + shift}%` }
          : undefined
      }
    >
      {children}
    </Tag>
  );
}
