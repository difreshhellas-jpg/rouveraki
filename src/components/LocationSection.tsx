"use client";

import { useI18n } from "@/i18n/LanguageProvider";
import { BRAND, DELIVERY_ZONES } from "@/lib/brand";
import { formatEuro } from "@/lib/money";
import Reveal from "./Reveal";

export default function LocationSection() {
  const { t, locale, pick } = useI18n();

  const fullAddress = `${BRAND.address.street}, ${BRAND.address.city} ${BRAND.address.postalCode}`;
  const mapsQuery = encodeURIComponent(`${fullAddress}, Greece`);

  return (
    <section
      id="location"
      className="mx-auto max-w-content scroll-mt-28 px-4 py-20 sm:px-6 sm:py-28"
    >
      <Reveal as="header" className="max-w-2xl">
        <h2 className="font-display text-[clamp(1.9rem,5vw,3rem)] font-bold leading-tight">
          {t("location.title")}
        </h2>
        <div className="tex-rope mt-6 w-24" />
      </Reveal>

      <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1.15fr]">
        {/* --- facts --------------------------------------------------- */}
        <Reveal className="space-y-6">
          <Fact title={t("location.addressTitle")}>
            <address className="not-italic">
              {BRAND.address.street}
              <br />
              {BRAND.address.city} {BRAND.address.postalCode}, {BRAND.address.region}
            </address>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex min-h-touch items-center font-semibold text-rust underline underline-offset-4"
            >
              {t("location.directions")}
            </a>
          </Fact>

          <Fact title={t("location.phoneTitle")}>
            <a
              href={`tel:${BRAND.phone.tel}`}
              className="inline-flex min-h-touch items-center text-lg font-semibold text-rust underline underline-offset-4"
            >
              {BRAND.phone.display}
            </a>
          </Fact>

          <div className="grid gap-4 sm:grid-cols-2">
            <Fact title={t("location.hoursTitle")}>
              <p className="text-lg font-semibold">{t("location.hoursValue")}</p>
            </Fact>
            <Fact title={t("location.deliveryTitle")}>
              <p className="text-lg font-semibold">{t("location.deliveryValue")}</p>
            </Fact>
          </div>

          <Fact title={t("location.zonesTitle")}>
            <ul className="divide-y divide-line">
              {DELIVERY_ZONES.map((z) => (
                <li key={z.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
                  <span className="font-semibold">{pick(z.el, z.en)}</span>
                  <span className="text-sm text-char/70">
                    {t("location.zoneMinimum")} {formatEuro(z.minimumOrder, locale === "en" ? "en-IE" : "el-GR")}
                    {" · "}
                    {t("location.zoneFee")}{" "}
                    {z.deliveryFee === 0
                      ? t("location.zoneFree")
                      : formatEuro(z.deliveryFee, locale === "en" ? "en-IE" : "el-GR")}
                  </span>
                </li>
              ))}
            </ul>
          </Fact>
        </Reveal>

        {/* --- map ------------------------------------------------------ */}
        <Reveal delayMs={80}>
          <div className="h-full min-h-[22rem] overflow-hidden rounded-card border border-line shadow-card">
            <iframe
              title={t("location.mapLabel")}
              src={`https://www.google.com/maps?q=${mapsQuery}&hl=${locale}&z=16&output=embed`}
              className="size-full min-h-[22rem]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              // Keeping the map sandboxed and out of the referrer chain is the
              // difference between an embed and a third-party tracker.
              allowFullScreen={false}
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Fact({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-char/60">
        {title}
      </h3>
      <div className="mt-2 text-char/90">{children}</div>
    </div>
  );
}
