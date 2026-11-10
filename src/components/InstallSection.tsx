"use client";

import Image from "next/image";
import { Bell, Lightning, ArrowsClockwise } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/LanguageProvider";
import { isStandalone } from "@/lib/install";
import InstallButton, { useInstallMode, useMounted } from "./InstallButton";
import Reveal from "./Reveal";

/**
 * Homepage section that invites visitors to put Rouveraki on their phone.
 * Phones get the one-tap install button; a desktop visitor is told to open
 * the site on their phone instead. Hidden when already running as the app.
 */
export default function InstallSection() {
  const { pick } = useI18n();
  const mode = useInstallMode();
  const mounted = useMounted();
  if (mounted && isStandalone()) return null;

  const perks = [
    { icon: Lightning, el: "Παραγγελία με ένα άγγιγμα", en: "Order in one tap" },
    { icon: ArrowsClockwise, el: "Το μενού πάντα ενημερωμένο", en: "Always the current menu" },
    { icon: Bell, el: "Χωρίς App Store, χωρίς λογαριασμό", en: "No app store, no account" },
  ];

  return (
    <section id="app" className="mx-auto max-w-content scroll-mt-28 px-4 py-16 sm:px-6 sm:py-20">
      <Reveal>
        <div className="card flex flex-col items-center gap-8 overflow-hidden p-7 text-center sm:p-10 md:flex-row md:text-left">
          <div className="relative size-28 shrink-0 overflow-hidden rounded-[1.75rem] shadow-lift sm:size-32">
            <Image src="/icons/icon-512.png" alt="" fill sizes="128px" className="object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{pick("Εφαρμογή", "App")}</p>
            <h2 className="mt-2 font-display text-[clamp(1.7rem,4.5vw,2.6rem)] font-bold leading-tight">
              {pick("Το Ρουβεράκι στο κινητό σου", "Rouveraki on your phone")}
            </h2>
            <ul className="mt-4 space-y-2 text-char/75">
              {perks.map(({ icon: Icon, el, en }) => (
                <li key={el} className="flex items-center justify-center gap-2 md:justify-start">
                  <Icon size={18} weight="bold" className="shrink-0 text-rust" aria-hidden />
                  {pick(el, en)}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex justify-center md:justify-start">
              {mounted && mode !== "none" ? (
                <InstallButton variant="primary" />
              ) : (
                <p className="max-w-md rounded-xl bg-char/5 px-4 py-3 text-sm text-char/70">
                  {pick(
                    "Άνοιξε τη σελίδα από το κινητό σου (Chrome σε Android, Safari σε iPhone) και πάτα «Κατέβασε την εφαρμογή».",
                    "Open this page on your phone (Chrome on Android, Safari on iPhone) and tap “Get the app”.",
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
