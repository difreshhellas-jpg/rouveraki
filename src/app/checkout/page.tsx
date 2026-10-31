"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useI18n } from "@/i18n/LanguageProvider";
import { useCart, cartTotals, type FulfillmentType } from "@/store/cart";
import { formatEuro } from "@/lib/money";
import { isDeliveryOpen, isShopOpen } from "@/lib/hours";
import { normalizeGreekPhone } from "@/lib/sanitize";
import QuantityStepper from "@/components/QuantityStepper";
import { apiFetch } from "@/lib/api";

/** Both are paid at the door: cash, or card on the delivery driver's POS. */
type PaymentMethod = "cash" | "card";

export default function CheckoutPage() {
  const { t, pick, locale } = useI18n();
  const router = useRouter();

  const lines = useCart((s) => s.lines);
  const fulfillmentType = useCart((s) => s.fulfillmentType);
  const setFulfillment = useCart((s) => s.setFulfillment);
  const setQuantity = useCart((s) => s.setQuantity);
  const removeLine = useCart((s) => s.removeLine);
  const clear = useCart((s) => s.clear);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [clock, setClock] = useState<{ shop: boolean; delivery: boolean } | null>(null);
  useEffect(() => {
    const read = () => setClock({ shop: isShopOpen(), delivery: isDeliveryOpen() });
    read();
    const id = setInterval(read, 30_000);
    return () => clearInterval(id);
  }, []);

  // Delivery zones are off for now, so there is no zone fee or minimum.
  const totals = cartTotals(lines, fulfillmentType, null);
  const money = (cents: number) =>
    formatEuro(cents / 100, locale === "en" ? "en-IE" : "el-GR");

  // Delivery outside its hours is not an option; snap to pickup rather than
  // letting someone fill in an address that cannot be served.
  useEffect(() => {
    if (clock && !clock.delivery && fulfillmentType === "delivery") {
      setFulfillment("pickup");
    }
  }, [clock, fulfillmentType, setFulfillment]);

  /* ---- validation ------------------------------------------------------ */

  const validate = (): string[] => {
    const e: string[] = [];
    if (!name.trim()) e.push(t("checkout.error.name"));
    if (!normalizeGreekPhone(phone)) e.push(t("checkout.error.phone"));
    if (fulfillmentType === "delivery" && !address.trim()) {
      e.push(t("checkout.error.address"));
    }
    return e;
  };

  /* ---- submit ---------------------------------------------------------- */

  const submit = async () => {
    const e = validate();
    setErrors(e);
    if (e.length) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: lines.map((l) => ({
            menuItemId: l.menuItemId,
            quantity: l.quantity,
            itemNotes: l.itemNotes,
            // Lets the demo backend refuse an order whose price changed meanwhile.
            unitPriceCents: l.unitPriceCents,
          })),
          fulfillmentType,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          customerAddress: fulfillmentType === "delivery" ? address.trim() : null,
          generalNotes: generalNotes.trim() || null,
          paymentMethod,
          marketingOptIn,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        redirectUrl?: string | null;
        trackingUrl?: string;
        orderCode?: string;
        /** The sold-out or re-priced item, when the error is about one. */
        name?: string;
      };

      if (!res.ok) {
        const msg = serverErrorMessage(data.error, t);
        setErrors([data.name ? `${msg} (${data.name})` : msg]);
        setSubmitting(false);
        // The message sits at the top; the button is in the bottom bar.
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      // The cart has done its job; clearing it here stops a browser Back from
      // letting the same order be placed twice.
      clear();

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      router.push(data.trackingUrl ?? `/order/${data.orderCode}`);
    } catch {
      setErrors([t("checkout.error.generic")]);
      setSubmitting(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  /* ---- render ---------------------------------------------------------- */

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-content px-4 py-24 text-center text-char/60">
        {t("common.loading")}
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="mx-auto max-w-content px-4 py-24 text-center sm:px-6">
        <h1 className="font-display text-3xl font-bold">{t("cart.title")}</h1>
        <p className="mt-3 text-char/65">{t("cart.empty")}</p>
        <Link href="/menu" className="btn-primary mt-6">
          {t("cart.emptyCta")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">
      <h1 className="font-display text-[clamp(1.9rem,6vw,2.75rem)] font-bold">
        {t("checkout.title")}
      </h1>

      {clock && !clock.shop && (
        <p role="alert" className="mt-6 rounded-card border border-rust/30 bg-rust/10 p-4 text-sm font-semibold text-rust">
          {t("checkout.shopClosed")}
        </p>
      )}

      {errors.length > 0 && (
        <div
          role="alert"
          className="mt-6 rounded-card border border-rust/40 bg-rust/10 p-4 text-sm text-rust"
        >
          <ul className="space-y-1">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ---- order ------------------------------------------------------- */}
      <section className="mt-8 space-y-4" aria-label={t("checkout.step.cart")}>
          <ul className="card divide-y divide-line">
            {lines.map((l) => (
              <li key={l.lineId} className="flex gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug">{pick(l.name, l.nameEn)}</p>
                  {l.itemNotes && (
                    <p className="mt-0.5 text-sm italic text-char/60">
                      &ldquo;{l.itemNotes}&rdquo;
                    </p>
                  )}
                  <p className="mt-1 text-sm text-char/60">
                    {money(l.unitPriceCents)} × {l.quantity} ={" "}
                    <span className="font-semibold text-char/80">
                      {money(l.unitPriceCents * l.quantity)}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => removeLine(l.lineId)}
                    className="mt-1 inline-flex min-h-9 items-center text-sm font-semibold text-rust underline underline-offset-4"
                  >
                    {t("cart.remove")}
                  </button>
                </div>
                <QuantityStepper
                  min={0}
                  value={l.quantity}
                  onChange={(q) => setQuantity(l.lineId, q)}
                  label={pick(l.name, l.nameEn)}
                />
              </li>
            ))}
          </ul>

          <Link href="/menu" className="btn-secondary w-full">
            {t("cart.addMore")}
          </Link>
      </section>

      {/* ---- details ----------------------------------------------------- */}
      <section className="mt-8 space-y-6" aria-label={t("checkout.step.details")}>
          <fieldset className="card p-5">
            <legend className="label px-1">{t("checkout.fulfillment")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {(["delivery", "pickup"] as FulfillmentType[]).map((f) => {
                const disabled = f === "delivery" && clock !== null && !clock.delivery;
                return (
                  <label
                    key={f}
                    className={clsx(
                      "flex min-h-touch cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-colors",
                      fulfillmentType === f
                        ? "border-rust bg-rust/5"
                        : "border-line hover:bg-char/5",
                      disabled && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <input
                      type="radio"
                      name="fulfillment"
                      value={f}
                      disabled={disabled}
                      checked={fulfillmentType === f}
                      onChange={() => setFulfillment(f)}
                      className="size-5 accent-[rgb(var(--rouveraki-rust-rgb))]"
                    />
                    <span className="font-semibold">
                      {f === "delivery" ? t("checkout.delivery") : t("checkout.pickup")}
                    </span>
                  </label>
                );
              })}
            </div>
            {clock && !clock.delivery && (
              <p className="mt-3 text-sm text-char/65">{t("checkout.deliveryClosed")}</p>
            )}
          </fieldset>

          <div className="card space-y-4 p-5">
            <div>
              <label className="label" htmlFor="co-name">
                {t("checkout.name")}
              </label>
              <input
                id="co-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                maxLength={120}
                required
                className="field"
              />
            </div>

            <div>
              <label className="label" htmlFor="co-phone">
                {t("checkout.phone")}
              </label>
              <input
                id="co-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                maxLength={30}
                required
                aria-describedby="co-phone-help"
                className="field"
              />
              <p id="co-phone-help" className="mt-1.5 text-xs text-char/55">
                {t("checkout.phoneHelp")}
              </p>
            </div>

            {fulfillmentType === "delivery" && (
              <>
                <div>
                  <label className="label" htmlFor="co-address">
                    {t("checkout.address")}
                  </label>
                  <input
                    id="co-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    autoComplete="street-address"
                    maxLength={300}
                    required
                    placeholder={t("checkout.addressPlaceholder")}
                    className="field"
                  />
                </div>
              </>
            )}

            <div>
              <label className="label" htmlFor="co-notes">
                {t("checkout.generalNotes")}{" "}
                <span className="font-normal text-char/50">({t("common.optional")})</span>
              </label>
              <textarea
                id="co-notes"
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                rows={2}
                maxLength={400}
                placeholder={t("checkout.generalNotesPlaceholder")}
                className="field resize-none"
              />
            </div>
          </div>
      </section>

      {/* ---- payment ----------------------------------------------------- */}
      <section className="mt-8 space-y-6" aria-label={t("checkout.step.payment")}>
          <fieldset className="card p-5">
            <legend className="label px-1">{t("checkout.paymentMethod")}</legend>
            <div className="space-y-2">
              {(
                [
                  { id: "cash", label: t("checkout.payCash"), help: t("checkout.payCashHelp") },
                  {
                    id: "card",
                    // Card is taken on a POS: the driver's for delivery, the shop's for pickup.
                    label: fulfillmentType === "delivery"
                      ? t("checkout.payCard")
                      : t("checkout.payCardPickup"),
                    help: fulfillmentType === "delivery"
                      ? t("checkout.payCardHelp")
                      : t("checkout.payCardPickupHelp"),
                  },
                ] as const
              ).map((m) => (
                <label
                  key={m.id}
                  className={clsx(
                    "flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition-colors",
                    paymentMethod === m.id
                      ? "border-rust bg-rust/5"
                      : "border-line hover:bg-char/5",
                  )}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={m.id}
                    checked={paymentMethod === m.id}
                    onChange={() => setPaymentMethod(m.id)}
                    className="mt-0.5 size-5 accent-[rgb(var(--rouveraki-rust-rgb))]"
                  />
                  <span className="flex-1">
                    <span className="font-semibold">{m.label}</span>
                    <span className="mt-0.5 block text-sm text-char/60">{m.help}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex cursor-pointer items-start gap-3 px-1 text-sm">
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-[rgb(var(--rouveraki-rust-rgb))]"
            />
            <span className="text-char/75">{t("checkout.marketingOptIn")}</span>
          </label>

          {/* ---- totals ------------------------------------------------- */}
          <dl className="card space-y-2 p-5 text-sm">
            <div className="flex justify-between">
              <dt className="text-char/70">{t("cart.subtotal")}</dt>
              <dd className="font-semibold">{money(totals.subtotalCents)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-lg">
              <dt className="font-bold">{t("cart.total")}</dt>
              <dd className="font-bold text-rust">{money(totals.totalCents)}</dd>
            </div>
          </dl>

          <p className="px-1 text-xs leading-relaxed text-char/60">
            {t("checkout.terms")}{" "}
            <Link href="/legal/terms" className="underline underline-offset-2">
              {t("legal.terms")}
            </Link>{" "}
            ·{" "}
            <Link href="/legal/privacy" className="underline underline-offset-2">
              {t("legal.privacy")}
            </Link>
          </p>
      </section>

      {/* ---- sticky action bar ------------------------------------------ */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-sand/95 backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => router.push("/menu")}
            className="btn-secondary px-5"
          >
            {t("checkout.back")}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || (clock !== null && !clock.shop)}
            className="btn-primary flex-1 disabled:pointer-events-none disabled:opacity-60"
          >
            {submitting
              ? <><span className="loader" aria-hidden="true" /> {t("checkout.submitting")}</>
              : `${t("checkout.submitCash")} · ${money(totals.totalCents)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Maps the API's error codes onto something a customer can act on. */
function serverErrorMessage(
  code: string | undefined,
  t: (k: never) => string,
): string {
  const tr = t as unknown as (k: string) => string;
  switch (code) {
    case "rate_limited":
      return tr("checkout.error.rateLimited");
    case "item_unavailable":
    case "unknown_menu_item":
      return tr("checkout.error.itemUnavailable");
    case "price_changed":
      return tr("checkout.error.priceChanged");
    case "menu_unavailable":
      return tr("checkout.error.menuUnavailable");
    case "delivery_closed":
      return tr("checkout.deliveryClosed");
    case "shop_closed":
      return tr("checkout.shopClosed");
    case "invalid_phone":
      return tr("checkout.error.phone");
    case "address_required":
      return tr("checkout.error.address");
    default:
      return tr("checkout.error.generic");
  }
}
