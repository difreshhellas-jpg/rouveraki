"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { List, X, Phone } from "@phosphor-icons/react";
import clsx from "clsx";
import { useI18n } from "@/i18n/LanguageProvider";
import { BRAND } from "@/lib/brand";
import LanguageToggle from "./LanguageToggle";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
  const { t } = useI18n();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Admin screens have their own chrome; the marketing header would only get in
  // the way on a kitchen tablet.
  const isAdmin = pathname?.startsWith("/admin");

  /**
   * A one-pixel sentinel near the top of the document, watched by an
   * IntersectionObserver. When it scrolls out of view the header is "scrolled".
   *
   * No scroll listener: a listener fires on every frame and would re-render
   * this component continuously. The observer fires twice in total, once each
   * way past the threshold.
   */
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  if (isAdmin) return null;

  const links = [
    { href: "/", label: t("nav.home") },
    { href: "/menu", label: t("nav.menu") },
    { href: "/#location", label: t("nav.contact") },
  ];

  return (
    <>
      {/* Watched by the observer above to decide the header's scrolled state. */}
      <div ref={sentinelRef} aria-hidden="true" className="absolute top-6 h-px w-px" />

      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-rust focus:px-5 focus:py-3 focus:text-onrust"
      >
        {t("nav.skipToContent")}
      </a>

      <header
        className={clsx(
          "sticky top-0 z-50 transition-colors duration-300",
          scrolled
            ? "border-b border-line bg-sand/90 backdrop-blur-md"
            : "bg-transparent",
        )}
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="mx-auto flex max-w-content items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="inline-flex min-h-touch items-center font-display text-xl font-bold tracking-tight text-char sm:text-2xl"
          >
            {BRAND.nameEl}
          </Link>

          <nav aria-label="primary" className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="btn-ghost text-[0.95rem] font-medium"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden sm:block">
              <LanguageToggle />
            </div>
            <ThemeToggle />
            <a
              href={`tel:${BRAND.phone.tel}`}
              className="hidden size-touch items-center justify-center rounded-full text-char/70 transition-colors hover:bg-char/5 hover:text-char sm:inline-flex"
              aria-label={`${t("location.phoneTitle")}: ${BRAND.phone.display}`}
            >
              <Phone size={20} weight="regular" />
            </a>
            <Link href="/menu" className="btn-primary hidden px-5 text-sm lg:inline-flex">
              {t("hero.cta")}
            </Link>

            <button
              type="button"
              className="inline-flex size-touch items-center justify-center rounded-full text-char md:hidden"
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              aria-label={t("nav.menu")}
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <X size={22} weight="bold" /> : <List size={22} weight="bold" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div
            id="mobile-nav"
            className="border-t border-line bg-sand px-4 pb-4 pt-2 md:hidden"
          >
            <nav aria-label="mobile" className="flex flex-col">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="flex min-h-touch items-center border-b border-line/60 text-base font-medium"
                >
                  {l.label}
                </Link>
              ))}
              <a
                href={`tel:${BRAND.phone.tel}`}
                className="flex min-h-touch items-center border-b border-line/60 text-base font-medium"
              >
                {BRAND.phone.display}
              </a>
            </nav>
            <div className="mt-3 flex items-center justify-between gap-3">
              <LanguageToggle />
              <Link href="/menu" className="btn-primary flex-1 text-sm">
                {t("hero.cta")}
              </Link>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
