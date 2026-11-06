"use client";

import { useEffect, useState } from "react";
import { ShoppingBag } from "@phosphor-icons/react";
import clsx from "clsx";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/LanguageProvider";
import { useCart, cartCount, cartSubtotalCents } from "@/store/cart";
import { formatEuro } from "@/lib/money";
import dynamic from "next/dynamic";

// Loaded when the cart is first opened, not on every page that shows the bar.
const CartSheet = dynamic(() => import("./CartSheet"), { ssr: false });

/**
 * Persistent floating cart bar. Appears as soon as there is one item, sits
 * within thumb reach at the bottom of the viewport, and clears the phone's
 * home indicator via the safe-area inset.
 *
 * Hidden on checkout (the cart is the page there), on the tracking page and in
 * admin, where it would be noise.
 */
const HIDDEN_ON = ["/checkout", "/order", "/admin", "/demo-kitchen"];

export default function CartBar() {
  const { t, locale } = useI18n();
  const pathname = usePathname() ?? "/";
  const lines = useCart((s) => s.lines);
  const lastAddedAt = useCart((s) => s.lastAddedAt);
  const [open, setOpen] = useState(false);

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
      {/*
        translateY(100%) is the element's own height, so the bar hides itself
        exactly regardless of how tall it renders. A CSS transition rather than
        a JS animation: it retargets mid-flight if the cart empties while the
        bar is still sliding in, where a keyframe would restart from zero.
      */}
      <div
        className={clsx(
          "pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4",
          "transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
          count > 0 ? "translate-y-0 opacity-100" : "translate-y-full opacity-0",
        )}
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
        aria-hidden={count === 0}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          tabIndex={count === 0 ? -1 : 0}
          className={clsx(
            "btn pointer-events-auto flex w-full max-w-md items-center justify-between",
            "gap-4 rounded-full bg-rust px-5 py-3.5 text-onrust shadow-lift",
            bump && "motion-safe:animate-cart-bump",
          )}
        >
          <span className="flex items-center gap-2.5">
            <ShoppingBag size={20} weight="fill" aria-hidden="true" />
            <span
              key={count}
              className="inline-flex size-7 items-center justify-center rounded-full bg-onrust/20 text-sm font-bold tabular-nums motion-safe:animate-count-pop"
            >
              {count}
            </span>
            <span className="font-semibold">{t("cart.viewCart")}</span>
          </span>
          <span className="font-bold tabular-nums">
            {formatEuro(subtotal / 100, locale === "en" ? "en-IE" : "el-GR")}
          </span>
        </button>
      </div>

      <CartSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
