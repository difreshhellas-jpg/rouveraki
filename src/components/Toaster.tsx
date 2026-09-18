"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckCircle, Warning, Info, X } from "@phosphor-icons/react";
import { SPRING_TOAST, EASE_EXIT } from "@/lib/motion";

/**
 * Toasts, in the Sonner idiom.
 *
 * - springs in from below on mobile, from the side on desktop
 * - stacks, newest nearest the edge, older ones scaled back slightly
 * - drag it away to dismiss (down on mobile, right on desktop)
 * - auto-dismisses, but the timer pauses while the pointer is over the stack
 * - aria-live="polite" so it is announced without stealing focus
 *
 * Deliberately not a library: three variants and a stack of two is the whole
 * requirement here, and this is smaller than the dependency would be.
 */

type ToastVariant = "success" | "error" | "info";

type Toast = {
  id: number;
  message: string;
  detail?: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  toast: (message: string, opts?: { detail?: string; variant?: ToastVariant }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 3600;
const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, number>());
  const reduce = useReducedMotion();

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const schedule = useCallback(
    (id: number) => {
      const timer = window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const toast = useCallback<ToastContextValue["toast"]>(
    (message, opts) => {
      const id = nextId.current++;
      setToasts((t) => [
        ...t.slice(-(MAX_VISIBLE - 1)),
        { id, message, detail: opts?.detail, variant: opts?.variant ?? "success" },
      ]);
      schedule(id);
    },
    [schedule],
  );

  // Hovering the stack pauses every pending dismissal, so a toast cannot
  // vanish from under the cursor while it is being read.
  const pause = useCallback(() => {
    for (const timer of timers.current.values()) window.clearTimeout(timer);
    timers.current.clear();
  }, []);

  const resume = useCallback(() => {
    setToasts((current) => {
      for (const t of current) if (!timers.current.has(t.id)) schedule(t.id);
      return current;
    });
  }, [schedule]);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        aria-live="polite"
        aria-atomic="false"
        onPointerEnter={pause}
        onPointerLeave={resume}
        className="
          pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col
          items-center gap-2 px-4
          sm:inset-x-auto sm:right-4 sm:items-end
        "
        style={{
          paddingBottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {/* Default mode, not popLayout: popLayout takes exiting children out of
              flow and its layout projection strands the entering toast at its
              initial values inside this flex column. */}
        <AnimatePresence initial={false}>
          {toasts.map((t, i) => {
            const depth = toasts.length - 1 - i;
            return (
              /*
                Two elements on purpose. Motion's `drag` takes ownership of the
                `y` motion value, so animating `y` on the same element leaves it
                pinned at its initial value and the toast never appears. The
                wrapper owns the entrance and exit; the child owns the drag.
              */
              <motion.div
                key={t.id}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.94 }}
                animate={
                  reduce
                    ? { opacity: 1 }
                    : {
                        opacity: 1,
                        y: 0,
                        // Older toasts sit back a touch so the newest reads first.
                        scale: 1 - depth * 0.04,
                      }
                }
                exit={
                  reduce
                    ? { opacity: 0, transition: EASE_EXIT }
                    : { opacity: 0, y: 12, scale: 0.96, transition: EASE_EXIT }
                }
                transition={SPRING_TOAST}
                className="pointer-events-auto w-full max-w-sm"
              >
              <motion.div
                drag={reduce ? false : "y"}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.6 }}
                onDragEnd={(_, info) => {
                  // A flick counts as well as a long drag, so dismissing does
                  // not require dragging the full height of the toast.
                  if (info.offset.y > 60 || info.velocity.y > 500) dismiss(t.id);
                }}
                className="
                  flex w-full cursor-grab items-start gap-3 rounded-card border
                  border-line bg-surface p-3.5 shadow-lift active:cursor-grabbing
                "
              >
                <span className="mt-0.5 shrink-0" aria-hidden="true">
                  {t.variant === "success" && (
                    <CheckCircle size={20} weight="fill" className="text-emerald-600" />
                  )}
                  {t.variant === "error" && (
                    <Warning size={20} weight="fill" className="text-rust" />
                  )}
                  {t.variant === "info" && (
                    <Info size={20} weight="fill" className="text-char/60" />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug">{t.message}</p>
                  {t.detail && (
                    <p className="mt-0.5 truncate text-sm text-char/60">{t.detail}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  aria-label="Κλείσιμο"
                  className="-m-1 shrink-0 rounded-full p-1 text-char/40 transition-colors hover:text-char"
                >
                  <X size={16} weight="bold" />
                </button>
              </motion.div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  // Returning a no-op rather than throwing keeps a component usable in
  // isolation (tests, storybook) without a provider above it.
  return ctx ?? { toast: () => {} };
}
