"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { motion, useReducedMotion, type PanInfo } from "motion/react";
import { X } from "@phosphor-icons/react";
import { SPRING_SHEET } from "@/lib/motion";

/**
 * The one sheet used by the item detail and the cart.
 *
 * Bottom sheet on mobile, centred dialog from `sm` up. Built on the native
 * <dialog> element so the focus trap, Escape handling and inerting the page
 * behind it come from the platform rather than from key handlers that are
 * always subtly wrong. Motion animates the panel inside it, and on mobile the
 * panel can be dragged down to dismiss with a grab handle to advertise it.
 *
 * Drag dismissal is disabled under reduced motion, where the close button is
 * the only affordance.
 */
export default function Sheet({
  open,
  onClose,
  title,
  titleId,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  titleId: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handle = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog.addEventListener("close", handle);
    dialog.addEventListener("cancel", handle);
    return () => {
      dialog.removeEventListener("close", handle);
      dialog.removeEventListener("cancel", handle);
    };
  }, [onClose]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    // Either a decisive flick or a long drag closes it. Matching only on
    // distance makes a quick flick feel broken.
    if (info.offset.y > 110 || info.velocity.y > 600) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="
        m-0 mt-auto max-h-[92svh] w-full max-w-none overflow-visible
        bg-transparent p-0 backdrop:bg-black/50 backdrop:backdrop-blur-[2px]
        sm:m-auto sm:max-w-lg
      "
    >
      {open && (
        /*
          Two elements on purpose. Motion's `drag` owns the `y` motion value, so
          animating `y` on the same element leaves it pinned at its initial
          offset and the sheet never slides in. The outer element owns the
          entrance; the inner one owns drag-to-dismiss.
        */
        <motion.div
          initial={reduce ? { opacity: 0 } : { y: "100%" }}
          animate={reduce ? { opacity: 1 } : { y: 0 }}
          transition={SPRING_SHEET}
        >
        <motion.div
          drag={reduce ? false : "y"}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.55 }}
          onDragEnd={onDragEnd}
          className="
            flex max-h-[92svh] flex-col overflow-hidden rounded-t-3xl border
            border-line bg-surface text-char shadow-lift sm:rounded-card
          "
        >
          {/* Grab handle. Decorative on desktop, the drag affordance on mobile. */}
          <div className="flex shrink-0 justify-center pt-2.5 sm:hidden">
            <span
              aria-hidden="true"
              className="h-1.5 w-10 rounded-full bg-char/20"
            />
          </div>

          {title && (
            <div className="flex shrink-0 items-center justify-between gap-4 px-5 pb-3 pt-3">
              <h2 id={titleId} className="font-display text-xl font-bold">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Κλείσιμο"
                className="-mr-1 inline-flex size-touch items-center justify-center rounded-full text-char/60 transition-colors hover:bg-char/5 hover:text-char"
              >
                <X size={20} weight="bold" />
              </button>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {children}
          </div>

          {footer && (
            <div
              className="shrink-0 border-t border-line bg-sand/60 p-5"
              style={{
                paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))",
              }}
            >
              {footer}
            </div>
          )}
        </motion.div>
        </motion.div>
      )}
    </dialog>
  );
}
