"use client";

import { Drawer } from "vaul";
import { X } from "@phosphor-icons/react";
import type { ReactNode } from "react";

/**
 * The one sheet used by the item detail and the cart, built on Vaul.
 *
 * This replaced a hand-rolled <dialog> plus a drag handler. Vaul does the four
 * things that separate a good drag from a bad one and are easy to get wrong by
 * hand: pointer capture so the drag survives leaving the element, multi-touch
 * protection, rising friction past the edge rather than a hard wall, and
 * velocity-based dismissal so a flick is enough without dragging the full
 * height. It also keeps the focus trap and Escape handling.
 *
 * Bottom sheet on every size. On desktop it is a smaller centred-width panel
 * anchored to the bottom, which keeps one component instead of two layouts.
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
  return (
    <Drawer.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px]" />
        <Drawer.Content
          className="
            fixed inset-x-0 bottom-0 z-[60] mx-auto flex max-h-[92svh] w-full
            max-w-lg flex-col overflow-hidden rounded-t-3xl border border-line
            bg-surface text-char shadow-lift outline-none
          "
        >
          {/* Vaul's drag handle. Advertises the gesture and is the grab area. */}
          <div className="flex shrink-0 justify-center pt-2.5">
            <Drawer.Handle className="!h-1.5 !w-10 !bg-char/20" />
          </div>

          {title ? (
            <div className="flex shrink-0 items-center justify-between gap-4 px-5 pb-3 pt-3">
              <Drawer.Title id={titleId} className="font-display text-xl font-bold">
                {title}
              </Drawer.Title>
              <button
                type="button"
                onClick={onClose}
                aria-label="Κλείσιμο"
                className="-mr-1 inline-flex size-touch items-center justify-center rounded-full text-char/60 transition-colors hover:bg-char/5 hover:text-char"
              >
                <X size={20} weight="bold" />
              </button>
            </div>
          ) : (
            // Vaul requires a Title for screen readers even when the design
            // puts the heading inside the body instead.
            <Drawer.Title className="sr-only">Λεπτομέρειες</Drawer.Title>
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
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
