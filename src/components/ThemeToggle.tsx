"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/LanguageProvider";

type Theme = "light" | "dark";

/**
 * Explicit light/dark override. With nothing stored the site follows the
 * viewer's OS setting; the toggle stamps data-theme on <html>, which the CSS in
 * globals.css lets win over prefers-color-scheme in both directions.
 */
export default function ThemeToggle() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = document.documentElement.dataset.theme;
    if (stored === "dark" || stored === "light") {
      setTheme(stored);
    } else {
      setTheme(
        window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
      );
    }
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("rouveraki.theme", next);
    } catch {
      /* private mode — the choice just does not persist */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("nav.themeToggle")}
      className="inline-flex size-touch items-center justify-center rounded-full text-char/70 transition-colors hover:bg-char/5 hover:text-char"
    >
      {/* Render nothing until the real theme is known, so the icon cannot flip
          on hydration. The button keeps its size, so nothing shifts. */}
      {theme === null ? null : theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
