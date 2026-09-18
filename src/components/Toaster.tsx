"use client";

import { Toaster as SonnerToaster, toast } from "sonner";
import { CheckCircle, Warning, Info } from "@phosphor-icons/react";

/**
 * Toasts, via Sonner.
 *
 * This replaced a hand-rolled implementation. Sonner already solves the parts
 * that were subtly wrong by hand: swipe-to-dismiss on a flick rather than a
 * distance threshold, hover-to-expand with the dismiss timer paused, stacking
 * that reflows when one leaves, focus handling, and an aria-live region that
 * announces without stealing focus.
 *
 * Styling is ours. `unstyled: false` with per-part classNames keeps Sonner's
 * behaviour and motion while the toast still looks like the rest of the site,
 * in both themes.
 */
export function ToastProvider() {
  return (
    <SonnerToaster
      position="bottom-center"
      // 32px would sit under the floating cart bar on mobile.
      mobileOffset={{ bottom: "6rem", left: "1rem", right: "1rem" }}
      // Same clearance on desktop: the floating cart bar is bottom-centre at
      // every width, and a toast landing on top of it hides the total.
      offset={{ bottom: "6rem", right: "1.5rem" }}
      visibleToasts={3}
      gap={10}
      // Sonner reads its own theme; ours is driven by data-theme on <html>,
      // so let it follow the system and let our classNames carry the colours.
      theme="system"
      icons={{
        success: <CheckCircle size={20} weight="fill" className="text-emerald-600" />,
        error: <Warning size={20} weight="fill" className="text-rust" />,
        info: <Info size={20} weight="fill" className="text-char/60" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "!bg-surface !border-line !text-char !rounded-card !shadow-lift !font-sans",
          title: "!text-sm !font-semibold !text-char",
          description: "!text-sm !text-char/60",
          actionButton: "!bg-rust !text-onrust !rounded-full !font-semibold",
          cancelButton: "!bg-char/10 !text-char !rounded-full",
          closeButton: "!bg-surface !border-line !text-char/60",
        },
      }}
    />
  );
}

type ToastOpts = { detail?: string; variant?: "success" | "error" | "info" };

/**
 * Kept as a hook so every existing call site works unchanged, and so the app
 * never imports Sonner directly. Swapping the toast library again would be one
 * file.
 */
export function useToast() {
  return {
    toast: (message: string, opts?: ToastOpts) => {
      const options = { description: opts?.detail };
      switch (opts?.variant) {
        case "error":
          return toast.error(message, options);
        case "info":
          return toast.info(message, options);
        default:
          return toast.success(message, options);
      }
    },
  };
}
