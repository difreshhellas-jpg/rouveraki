"use client";

import { useI18n } from "@/i18n/LanguageProvider";
import clsx from "clsx";

/**
 * Greek/English switch. A two-state segmented control rather than a dropdown:
 * there are exactly two options and a tourist should reach English in one tap.
 */
export default function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t("nav.langLabel")}
      className="inline-flex items-center rounded-full border border-line p-0.5 text-sm font-semibold"
    >
      {(["el", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          lang={l}
          className={clsx(
            "min-h-touch min-w-touch rounded-full px-3 transition-colors",
            locale === l
              ? "bg-rust text-onrust"
              : "text-char/70 hover:bg-char/5 hover:text-char",
          )}
        >
          {l === "el" ? "ΕΛ" : "EN"}
        </button>
      ))}
    </div>
  );
}
