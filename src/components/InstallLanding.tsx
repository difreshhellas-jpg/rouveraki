"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/LanguageProvider";
import InstallButton, { useInstallMode, useMounted } from "./InstallButton";

/** The /app page: icon, one big install button, and a way into the menu. */
export default function InstallLanding() {
  const { pick } = useI18n();
  const mode = useInstallMode();
  const mounted = useMounted();
  const router = useRouter();

  // Opened from the installed app itself: nothing to install, go order.
  useEffect(() => {
    if (mounted && mode === "none") router.replace("/menu");
  }, [mounted, mode, router]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center px-4 pb-24 pt-12 text-center sm:px-6">
      <div className="relative size-28 overflow-hidden rounded-[1.75rem] shadow-lift">
        <Image src="/icons/icon-512.png" alt="" fill sizes="112px" priority />
      </div>
      <h1 className="mt-6 font-display text-[clamp(2rem,8vw,2.75rem)] font-bold leading-tight">
        {pick("Το Ρουβεράκι στο κινητό σου", "Rouveraki on your phone")}
      </h1>
      <p className="mt-3 text-stone">
        {pick(
          "Παραγγελία με ένα άγγιγμα, ειδοποιήσεις για τις προσφορές και η παραγγελία σου πάντα ένα πάτημα μακριά.",
          "Order in one tap, hear about offers first, and keep your order one tap away.",
        )}
      </p>
      <div className="mt-8 w-full">
        <InstallButton variant="primary" className="w-full !py-4 !text-lg" />
      </div>
      {mounted && mode === "ios" && (
        <p className="mt-3 text-sm text-stone">
          {pick("Στο iPhone: πάτα το κουμπί και ακολούθησε τα δύο βήματα.", "On iPhone: tap the button and follow the two steps.")}
        </p>
      )}
      <Link href="/menu" className="mt-6 text-sm font-semibold text-accent underline underline-offset-4">
        {pick("Ή συνέχισε στο μενού", "Or go on to the menu")}
      </Link>
    </div>
  );
}
