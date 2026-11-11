"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import clsx from "clsx";
import { DeviceMobile, Export, PlusSquare } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/LanguageProvider";
import Sheet from "./Sheet";
import {
  installMode,
  isInAppBrowser,
  manualKind,
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
  label: labelOverride,
}: {
  label?: string;
  variant?: "icon" | "row" | "pill" | "primary";
  className?: string;
}) {
  const { pick } = useI18n();
  const mode = useInstallMode();
  const [iosOpen, setIosOpen] = useState(false);
  const mounted = useMounted();

  if (!mounted || mode === "none") return null;

  const label = labelOverride ?? pick("Εγκατάσταση εφαρμογής", "Install the app");
  const onClick = () => (mode === "prompt" ? void promptInstall() : setIosOpen(true));
  const kind = mode === "manual" ? manualKind() : null;

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
      ) : variant === "primary" ? (
        <button type="button" onClick={onClick} className={clsx("btn-primary gap-2 px-6 text-base", className)}>
          <DeviceMobile size={20} weight="bold" aria-hidden />
          {pick("Κατέβασε την εφαρμογή", "Get the app")}
        </button>
      ) : (
        <button type="button" onClick={onClick} className={clsx("btn-secondary gap-2 text-sm", className)}>
          <DeviceMobile size={18} weight="bold" aria-hidden />
          {label}
        </button>
      )}

      {mode === "manual" && kind && (
        <Sheet
          open={iosOpen}
          onClose={() => setIosOpen(false)}
          title={pick("Εγκατάσταση σαν εφαρμογή", "Install as an app")}
          titleId="install-manual-title"
        >
          <div className="space-y-4 px-5 pb-8 pt-1 text-base">
            {kind === "chromium" && (
              <ol className="list-decimal space-y-2 pl-5">
                <li>{pick("Πάτα το εικονίδιο εγκατάστασης ⊕ δεξιά στη γραμμή διευθύνσεων.", "Click the install icon ⊕ at the right of the address bar.")}</li>
                <li>{pick("Ή μενού ⋮ → «Μετάδοση, αποθήκευση και κοινοποίηση» → «Εγκατάσταση σελίδας ως εφαρμογής».", "Or menu ⋮ → “Cast, save and share” → “Install page as app”.")}</li>
                <li>{pick("Πάτα «Εγκατάσταση».", "Click “Install”.")}</li>
              </ol>
            )}
            {kind === "safari-mac" && (
              <ol className="list-decimal space-y-2 pl-5">
                <li>{pick("Στο Safari: μενού «Αρχείο» → «Προσθήκη στο Dock».", "In Safari: File menu → “Add to Dock”.")}</li>
                <li>{pick("Πάτα «Προσθήκη».", "Click “Add”.")}</li>
              </ol>
            )}
            {kind === "android" && (
              <ol className="list-decimal space-y-2 pl-5">
                <li>{pick("Άνοιξε το μενού του browser (⋮ ή ≡).", "Open the browser menu (⋮ or ≡).")}</li>
                <li>{pick("Διάλεξε «Προσθήκη στην αρχική οθόνη» ή «Εγκατάσταση εφαρμογής».", "Choose “Add to Home screen” or “Install app”.")}</li>
              </ol>
            )}
            {kind === "firefox" && (
              <p>{pick("Ο Firefox σε υπολογιστή δεν εγκαθιστά εφαρμογές. Άνοιξε τη σελίδα σε Chrome ή Edge και πάτα ξανά αυτό το κουμπί.", "Firefox on computers can't install apps. Open this page in Chrome or Edge and press this button again.")}</p>
            )}
            <p className="text-sm text-char/60">
              {pick("Μετά ανοίγει από το δικό της εικονίδιο, σε δικό της παράθυρο.", "It then opens from its own icon, in its own window.")}
            </p>
          </div>
        </Sheet>
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

/** Current install route for this device: "prompt" (Android/Chrome), "ios", or "none". */
export function useInstallMode(): InstallMode {
  return useSyncExternalStore<InstallMode>(subscribeInstall, installMode, () => "none");
}

export function useMounted(): boolean {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}
