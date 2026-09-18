"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ShoppingBag } from "@phosphor-icons/react";
import { SPRING_TAP, SPRING_SHEET, EASE_EXIT } from "@/lib/motion";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/LanguageProvider";
import { useCart, cartCount, cartSubtotalCents } from "@/store/cart";
import { formatEuro } from "@/lib/money";
import CartSheet from "./CartSheet";

/**
 * Persistent floating cart bar. Appears as soon as there is one item, sits
 * within thumb reach at the bottom of the viewport, and clears the phone's
 * home indicator via the safe-area inset.
 *
 * Hidden on checkout (the cart is the page there), on the tracking page and in
 * admin, where it would be noise.
 */
const HIDDEN_ON = ["/checkout", "/order", "/admin"];

export default function CartBar() {
  const { t, locale } = useI18n();
  const pathname = usePathname() ?? "/";
  const lines = useCart((s) => s.lines);
  const lastAddedAt = useCart((s) => s.lastAddedAt);
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  // Zustand's persist middleware rehydrates after mount; rendering the bar
  // before that would flash an empty cart on a reload.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Small nudge each time something is added, so the bar is noticed.
  const [bump, setBump] = useState(false);
  useEffect(() => {
    if (!lastAddedAt) return;
    setBump(true);
    const id = window.setTimeout(() => setBump(false), 260);
    return () => window.clearTimeout(id);
  }, [lastAddedAt]);

  const hidden = HIDDEN_ON.some((p) => pathname.startsWith(p));
  const count = cartCount(lines);
  const subtotal = cartSubtotalCents(lines);

  if (!hydrated || hidden) return null;

  return (
    <>
      <AnimatePresence>
        {count > 0 && (
          <motion.div
            initial={reduce ? { opacity: 0 } : { y: 88, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { y: 88, opacity: 0, transition: EASE_EXIT }}
            transition={SPRING_SHEET}
            className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <motion.button
              type="button"
              onClick={() => setOpen(true)}
              // The bar itself pulses when something is added, so the change is
              // felt at the bottom of the screen where the thumb already is.
              animate={bump && !reduce ? { scale: [1, 1.045, 1] } : { scale: 1 }}
              transition={SPRING_TAP}
              whileTap={reduce ? undefined : { scale: 0.97 }}
              className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-4 rounded-full bg-rust px-5 py-3.5 text-onrust shadow-lift"
            >
              <span className="flex items-center gap-2.5">
                <ShoppingBag size={20} weight="fill" aria-hidden="true" />
                <motion.span
                  key={count}
                  initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={SPRING_TAP}
                  className="inline-flex size-7 items-center justify-center rounded-full bg-onrust/20 text-sm font-bold tabular-nums"
                >
                  {count}
                </motion.span>
                <span className="font-semibold">{t("cart.viewCart")}</span>
              </span>
              <span className="font-bold tabular-nums">
                {formatEuro(subtotal / 100, locale === "en" ? "en-IE" : "el-GR")}
              </span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <CartSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
