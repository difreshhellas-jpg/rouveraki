import type { Transition } from "motion/react";

/**
 * Motion tokens.
 *
 * One vocabulary for the whole app so nothing feels like it came from a
 * different product. The reference points are Vaul and Sonner: springs rather
 * than duration curves, exits faster than entrances, and every animation
 * interruptible because a spring settles from wherever it currently is instead
 * of restarting.
 *
 * Only `transform` and `opacity` are ever animated.
 */

/** Sheets and drawers. Heavy enough to feel like an object, not a fade. */
export const SPRING_SHEET: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 38,
  mass: 0.9,
};

/** Toasts and small overlays. Slightly quicker and looser. */
export const SPRING_TOAST: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.7,
};

/** Buttons, chips, counters. Snappy, almost no overshoot. */
export const SPRING_TAP: Transition = {
  type: "spring",
  stiffness: 600,
  damping: 30,
  mass: 0.5,
};

/**
 * Exits run ~65% of the entrance, which is what makes a UI feel responsive
 * rather than sluggish when you dismiss something.
 */
export const EASE_EXIT: Transition = {
  duration: 0.16,
  ease: [0.4, 0, 1, 1],
};

/** Scroll reveals. A curve here, not a spring: these should feel calm. */
export const EASE_REVEAL: Transition = {
  duration: 0.55,
  ease: [0.16, 1, 0.3, 1],
};

/** Press feedback shared by every tappable surface. */
export const TAP_SCALE = { scale: 0.97 } as const;
export const HOVER_SCALE = { scale: 1.02 } as const;

/** Stagger between siblings in a revealing list. 45ms reads as one gesture. */
export const STAGGER_MS = 45;
