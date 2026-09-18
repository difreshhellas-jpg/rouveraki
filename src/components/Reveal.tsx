"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ElementType, ReactNode } from "react";
import { EASE_REVEAL } from "@/lib/motion";

/**
 * Fade-and-rise on scroll, for customer-facing pages only.
 *
 * Uses Motion's `whileInView`, which is an IntersectionObserver under the
 * hood, rather than a scroll listener. `once: true` means it fires one time and
 * stops costing anything.
 *
 * Under reduced motion the content renders immediately with no transform.
 * Admin screens deliberately do not use this: staff want the list, not a reveal.
 */
export default function Reveal({
  children,
  as = "div",
  delayMs = 0,
  className,
}: {
  children: ReactNode;
  as?: ElementType;
  delayMs?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const Tag = motion[as as keyof typeof motion] as typeof motion.div;

  if (reduce) {
    const Plain = as as ElementType;
    return <Plain className={className}>{children}</Plain>;
  }

  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15, margin: "0px 0px -8% 0px" }}
      transition={{ ...EASE_REVEAL, delay: delayMs / 1000 }}
    >
      {children}
    </Tag>
  );
}
