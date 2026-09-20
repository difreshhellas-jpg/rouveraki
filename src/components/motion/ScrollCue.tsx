"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Hero scroll cue: a drawn hairline with a highlight travelling down it.
 *
 * Deliberately not the usual "Scroll ↓" label. A reader looking at a hero
 * already knows what scrolling is, and the label is one of the clearest tells
 * of a templated page. The travelling highlight communicates direction without
 * spelling it out.
 *
 * Fades out permanently once the reader has passed 100px: after that it is
 * answering a question nobody is asking any more.
 *
 * Visibility is driven by an observed sentinel rather than a scroll listener,
 * so nothing runs per frame.
 */
export default function ScrollCue() {
  const [gone, setGone] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          setGone(true);
          observer.disconnect();
        }
      },
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinel} aria-hidden="true" className="absolute top-[100px] h-px w-px" />
      <div
        aria-hidden="true"
        className="scroll-cue absolute bottom-8 left-1/2 hidden -translate-x-1/2 sm:block"
        style={{ opacity: gone ? 0 : 1 }}
      />
    </>
  );
}
