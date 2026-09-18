"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import clsx from "clsx";

/**
 * Scroll reveal for marketing surfaces only. Not used in admin: staff want the
 * list, not a performance.
 *
 * Pure CSS transition driven by one IntersectionObserver, which disconnects the
 * moment it fires. No animation library and no scroll listener, so this costs
 * nothing after the first paint and cannot stutter under load the way a
 * rAF-driven animation does.
 *
 * Reduced motion is handled in globals.css, which forces [data-reveal] fully
 * visible, so there is no branch here that could leave content hidden.
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
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        observer.disconnect(); // fire once; re-animating fights the reader
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-reveal=""
      data-visible={shown ? "" : undefined}
      className={clsx("reveal", className)}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
