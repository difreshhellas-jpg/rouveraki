"use client";

import { useCallback, type MouseEvent } from "react";

/**
 * Click ripple, spreading from the exact point that was pressed.
 *
 * Returns a handler to spread onto any element that also carries the
 * `ripple-host` class (which supplies position + overflow clipping).
 *
 *   const ripple = useRipple();
 *   <button className="btn-primary ripple-host" onClick={(e) => { ripple(e); add(); }}>
 *
 * The span removes itself on animationend, so a fast tapper never accumulates
 * nodes. Skipped under reduced motion, where the button's own press scale is
 * already the acknowledgement.
 */
export function useRipple() {
  return useCallback((e: MouseEvent<HTMLElement>) => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const host = e.currentTarget;
    const rect = host.getBoundingClientRect();
    // Diameter reaches the far corner, so the ripple always covers the button
    // however off-centre the press was.
    const size = Math.hypot(rect.width, rect.height) * 2;

    const span = document.createElement("span");
    span.className = "ripple";
    span.style.width = span.style.height = `${size}px`;
    span.style.left = `${e.clientX - rect.left - size / 2}px`;
    span.style.top = `${e.clientY - rect.top - size / 2}px`;
    span.addEventListener("animationend", () => span.remove(), { once: true });
    host.appendChild(span);
  }, []);
}
