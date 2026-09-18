"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/i18n/LanguageProvider";
import { BRAND } from "@/lib/brand";
import ContactForm from "./ContactForm";

export default function Footer() {
  const { t } = useI18n();
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;

  const year = new Date().getFullYear();

  const legal = [
    { href: "/legal/terms", label: t("legal.terms") },
    { href: "/legal/privacy", label: t("legal.privacy") },
    { href: "/legal/cookies", label: t("legal.cookies") },
    { href: "/legal/refunds", label: t("legal.refunds") },
    { href: "/legal/allergens", label: t("legal.allergens") },
  ];

  return (
    <footer className="tex-wood mt-24 bg-band text-onband">
      <div className="mx-auto grid max-w-content gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <h2 className="font-display text-2xl font-bold">{t("contact.title")}</h2>
          <div className="tex-rope mt-4 w-20 opacity-80" />
          <div className="mt-6">
            <ContactForm />
          </div>
        </div>

        <div className="grid gap-8 sm:grid-cols-2 lg:pl-8">
          <div>
            <h3 className="font-display text-lg font-semibold">{BRAND.nameEl}</h3>
            <address className="mt-3 space-y-1 text-sm not-italic opacity-85">
              <div>{BRAND.address.street}</div>
              <div>
                {BRAND.address.city}, {BRAND.address.postalCode}
              </div>
              <div>{BRAND.address.region}</div>
              <a
                href={`tel:${BRAND.phone.tel}`}
                className="mt-3 inline-flex min-h-touch items-center font-semibold underline underline-offset-4"
              >
                {BRAND.phone.display}
              </a>
            </address>

            <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide opacity-70">
              {t("footer.followUs")}
            </h3>
            <a
              href={BRAND.facebook}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex min-h-touch items-center gap-2 text-sm underline underline-offset-4"
            >
              Facebook
            </a>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide opacity-70">
              {t("location.hoursTitle")}
            </h3>
            <p className="mt-2 text-sm opacity-85">{t("location.hoursValue")}</p>

            <h3 className="mt-5 text-sm font-semibold uppercase tracking-wide opacity-70">
              {t("location.deliveryTitle")}
            </h3>
            <p className="mt-2 text-sm opacity-85">{t("location.deliveryValue")}</p>

            <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide opacity-70">
              {t("footer.orderOnline")}
            </h3>
            <Link
              href="/menu"
              className="mt-2 inline-flex min-h-touch items-center text-sm font-semibold underline underline-offset-4"
            >
              {t("hero.cta")}
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-onband/15">
        <div
          className="mx-auto flex max-w-content flex-col gap-4 px-4 py-6 text-xs opacity-75 sm:flex-row sm:items-center sm:justify-between sm:px-6"
          style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <p>
            © {year} {BRAND.nameEl}. {t("footer.rights")}
          </p>
          <nav aria-label="legal" className="flex flex-wrap gap-x-4 gap-y-2">
            {legal.map((l) => (
              <Link key={l.href} href={l.href} className="inline-flex min-h-touch items-center underline underline-offset-4">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
