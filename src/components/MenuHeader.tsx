"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/LanguageProvider";
import { isDeliveryOpen, isShopOpen } from "@/lib/hours";
import { BRAND } from "@/lib/brand";

/** Page title plus an honest banner when we are closed or delivery is off. */
export default function MenuHeader() {
  const { t } = useI18n();
  const [state, setState] = useState<{ shop: boolean; delivery: boolean } | null>(
    null,
  );

  useEffect(() => {
    const read = () => setState({ shop: isShopOpen(), delivery: isDeliveryOpen() });
    read();
    const id = setInterval(read, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="mx-auto max-w-content px-4 pb-1 pt-6 sm:px-6 sm:pt-8">
      <p className="eyebrow">{BRAND.nameEl} · {t("location.hoursValue")}</p>
      <h1 className="mt-2 font-display text-[clamp(2.25rem,7vw,3.5rem)] font-semibold">
        {t("menu.title")}
      </h1>
      <p className="mt-2 text-stone">{t("menu.lead")}</p>

      {state && !state.shop && (
        <p
          role="status"
          className="mt-5 rounded-card border border-rust/30 bg-rust/10 p-4 text-sm font-semibold text-rust"
        >
          {t("checkout.shopClosed")}
        </p>
      )}
      {state && state.shop && !state.delivery && (
        <p
          role="status"
          className="mt-5 rounded-card border border-line bg-surface p-4 text-sm"
        >
          {t("checkout.deliveryClosed")}
        </p>
      )}
    </header>
  );
}
