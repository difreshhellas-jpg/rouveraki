"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { X } from "@phosphor-icons/react";
import Image from "next/image";
import { useI18n } from "@/i18n/LanguageProvider";
import { useCart } from "@/store/cart";
import InstallButton, { useInstallMode } from "./InstallButton";

const DISMISS_KEY = "rouveraki.install.dismissed";
const DISMISS_DAYS = 7;
const SKIP_ON = ["/checkout", "/order", "/admin", "/demo-kitchen", "/legal"];

/**
 * Small "get the app" card that slides up on phones a few seconds after
 * arriving. Closing it keeps it away for a week. Never on checkout, order
 * tracking or the shop screens, and never once installed.
 */
export default function InstallPrompt() {
  const { pick } = useI18n();
  const mode = useInstallMode();
  const pathname = usePathname() ?? "/";
  const hasCart = useCart((s) => s.lines.length > 0);
  const [show, setShow] = useState(false);

  const skip = SKIP_ON.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (mode === "none" || skip) return;
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    try {
      const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
      if (Date.now() - at < DISMISS_DAYS * 864e5) return;
    } catch {
      /* storage blocked: still show it, just not remembered */
    }
    const id = window.setTimeout(() => setShow(true), 6000);
    return () => window.clearTimeout(id);
  }, [mode, skip]);

  if (mode === "none" || skip) return null;

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      role="dialog"
      aria-label={pick("Κατέβασε την εφαρμογή", "Get the app")}
      aria-hidden={!show}
      className={clsx(
        "fixed inset-x-3 z-[55] mx-auto max-w-md transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
        hasCart ? "bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))]" : "bottom-[calc(0.75rem+env(safe-area-inset-bottom,0px))]",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-[130%] opacity-0",
      )}
    >
      <div className="glass flex items-center gap-3 rounded-2xl p-3 pr-2 shadow-lift">
        <div className="relative size-12 shrink-0 overflow-hidden rounded-xl">
          <Image src="/icons/icon-192.png" alt="" fill sizes="48px" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight">{pick("Το Ρουβεράκι σαν εφαρμογή", "Rouveraki as an app")}</p>
          <p className="text-xs text-char/65">{pick("Παραγγελία με ένα άγγιγμα", "Order in one tap")}</p>
        </div>
        <div onClickCapture={dismiss}>
          <InstallButton variant="pill" label={pick("Λήψη", "Get")} className="!min-h-0 !px-4 !py-2 !text-sm" />
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={pick("Κλείσιμο", "Close")}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-char/55 hover:bg-char/5"
        >
          <X size={16} weight="bold" />
        </button>
      </div>
    </div>
  );
}
