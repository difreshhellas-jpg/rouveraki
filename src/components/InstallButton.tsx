"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import clsx from "clsx";
import { DeviceMobile, Export, PlusSquare } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/LanguageProvider";
import Sheet from "./Sheet";
import {
  installMode,
  isInAppBrowser,
  promptInstall,
  subscribeInstall,
  type InstallMode,
} from "@/lib/install";

/**
 * One tap to put Rouveraki on the phone's home screen as an app.
 * Android/Chrome: the browser's own install dialog. iPhone/iPad: a short
 * sheet with the two Safari steps, since iOS has no install API.
 * Renders nothing once installed, or where installing is not possible.
 */
export default function InstallButton({
  variant = "icon",
  className,
}: {
  variant?: "icon" | "row" | "pill";
  className?: string;
}) {
  const { pick } = useI18n();
  const mode = useSyncExternalStore<InstallMode>(subscribeInstall, installMode, () => "none");
  const [iosOpen, setIosOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || mode === "none") return null;

  const label = pick("Εγκατάσταση εφαρμογής", "Install the app");
  const onClick = () => (mode === "prompt" ? void promptInstall() : setIosOpen(true));

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          title={label}
          className={clsx(
            "inline-flex size-touch items-center justify-center rounded-full text-char/70 transition-colors hover:bg-char/5 hover:text-char",
            className,
          )}
        >
          <DeviceMobile size={21} weight="regular" />
        </button>
      ) : variant === "row" ? (
        <button
          type="button"
          onClick={onClick}
          className={clsx(
            "flex min-h-touch w-full items-center gap-2 border-b border-line/60 text-left text-base font-medium",
            className,
          )}
        >
          <DeviceMobile size={20} weight="regular" aria-hidden />
          {label}
        </button>
      ) : (
        <button type="button" onClick={onClick} className={clsx("btn-secondary gap-2 text-sm", className)}>
          <DeviceMobile size={18} weight="bold" aria-hidden />
          {label}
        </button>
      )}

      {mode === "ios" && (
        <Sheet
          open={iosOpen}
          onClose={() => setIosOpen(false)}
          title={pick("Πρόσθεσέ μας στην οθόνη σου", "Add us to your Home Screen")}
          titleId="install-ios-title"
        >
          <div className="space-y-4 px-5 pb-8 pt-1 text-base">
            {isInAppBrowser() && (
              <p className="rounded-xl bg-gold/15 p-3 font-semibold">
                {pick(
                  "Άνοιξε πρώτα τη σελίδα στο Safari (μενού ··· → «Άνοιγμα στο Safari»).",
                  "First open this page in Safari (··· menu → “Open in Safari”).",
                )}
              </p>
            )}
            <ol className="space-y-3">
              <li className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-char/5">
                  <Export size={22} weight="bold" aria-hidden />
                </span>
                <span>
                  {pick("Πάτα το κουμπί ", "Tap the ")}
                  <b>{pick("Κοινοποίηση", "Share")}</b>
                  {pick(" στο κάτω μέρος του Safari.", " button at the bottom of Safari.")}
                </span>
              </li>
              <li className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-char/5">
                  <PlusSquare size={22} weight="bold" aria-hidden />
                </span>
                <span>
                  {pick("Διάλεξε ", "Choose ")}
                  <b>{pick("«Προσθήκη στην οθόνη Αφετηρίας»", "“Add to Home Screen”")}</b>
                  {pick(" και μετά «Προσθήκη».", ", then “Add”.")}
                </span>
              </li>
            </ol>
            <p className="text-sm text-char/60">
              {pick(
                "Το Ρουβεράκι θα ανοίγει από το εικονίδιο, σαν εφαρμογή.",
                "Rouveraki then opens from its icon, like an app.",
              )}
            </p>
          </div>
        </Sheet>
      )}
    </>
  );
}
