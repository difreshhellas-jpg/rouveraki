"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useI18n } from "@/i18n/LanguageProvider";
import {
  useCart,
  cartTotals,
  cartHasAgeGated,
  ALL_ZONES,
  type FulfillmentType,
} from "@/store/cart";
import { formatEuro } from "@/lib/money";
import { isDeliveryOpen, isShopOpen, isAlcoholSaleAllowed } from "@/lib/hours";
import { normalizeGreekPhone } from "@/lib/sanitize";
import QuantityStepper from "@/components/QuantityStepper";
import { apiFetch } from "@/lib/api";
import { DEMO_MODE } from "@/lib/demo/config";

type Step = 0 | 1 | 2;
type PaymentMethod = "iris" | "card" | "cash";

export default function CheckoutPage() {
  const { t, pick, locale } = useI18n();
  const router = useRouter();

  const lines = useCart((s) => s.lines);
  const fulfillmentType = useCart((s) => s.fulfillmentType);
  const zoneId = useCart((s) => s.zoneId);
  const setFulfillment = useCart((s) => s.setFulfillment);
  const setZone = useCart((s) => s.setZone);
  const setQuantity = useCart((s) => s.setQuantity);
  const removeLine = useCart((s) => s.removeLine);
  const clear = useCart((s) => s.clear);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("iris");
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [clock, setClock] = useState<{
    shop: boolean;
    delivery: boolean;
    alcohol: boolean;
  } | null>(null);
  useEffect(() => {
    const read = () =>
      setClock({
        shop: isShopOpen(),
        delivery: isDeliveryOpen(),
        alcohol: isAlcoholSaleAllowed(),
      });
    read();
    const id = setInterval(read, 30_000);
    return () => clearInterval(id);
  }, []);

  const totals = cartTotals(lines, fulfillmentType, zoneId);
  const hasAgeGated = cartHasAgeGated(lines);
  const money = (cents: number) =>
    formatEuro(cents / 100, locale === "en" ? "en-IE" : "el-GR");

  // Delivery outside its hours is not an option; snap to pickup rather than
  // letting someone fill in an address that cannot be served.
  useEffect(() => {
    if (clock && !clock.delivery && fulfillmentType === "delivery") {
      setFulfillment("pickup");
    }
  }, [clock, fulfillmentType, setFulfillment]);

  const steps = useMemo(
    () => [t("checkout.step.cart"), t("checkout.step.details"), t("checkout.step.payment")],
    [t],
  );

  /* ---- validation ------------------------------------------------------ */

  const validateDetails = (): string[] => {
    const e: string[] = [];
    if (!name.trim()) e.push(t("checkout.error.name"));
    if (!normalizeGreekPhone(phone)) e.push(t("checkout.error.phone"));
    if (fulfillmentType === "delivery") {
      if (!address.trim()) e.push(t("checkout.error.address"));
      if (!zoneId) e.push(t("checkout.error.zone"));
      if (zoneId && !totals.meetsMinimum) e.push(t("checkout.error.minimum"));
    }
    return e;
  };

  const validatePayment = (): string[] => {
    const e: string[] = [];
    if (hasAgeGated && !ageConfirmed) e.push(t("checkout.error.age"));
    if (hasAgeGated && clock && !clock.alcohol) {
      e.push(t("checkout.alcoholHoursBlocked"));
    }
    return e;
  };

  const goNext = () => {
    const e = step === 1 ? validateDetails() : [];
    setErrors(e);
    if (e.length) return;
    setStep((s) => (s === 2 ? 2 : ((s + 1) as Step)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    setErrors([]);
    setStep((s) => (s === 0 ? 0 : ((s - 1) as Step)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ---- submit ---------------------------------------------------------- */

  const submit = async () => {
    const e = [...validateDetails(), ...validatePayment()];
    setErrors(e);
    if (e.length) return;

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
          })),
          fulfillmentType,
          customerName: name.trim(),
          customerPhone: phone.trim(),
          customerAddress: fulfillmentType === "delivery" ? address.trim() : null,
          deliveryZone: fulfillmentType === "delivery" ? zoneId : null,
          generalNotes: generalNotes.trim() || null,
          paymentMethod,
          ageVerified: hasAgeGated ? ageConfirmed : false,
          marketingOptIn,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        redirectUrl?: string | null;
        trackingUrl?: string;
        orderCode?: string;
        minimumCents?: number;
      };

      if (!res.ok) {
        setErrors([serverErrorMessage(data.error, t, money, data)]);
        setSubmitting(false);
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

  const zone = ALL_ZONES.find((z) => z.id === zoneId);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-32 pt-10 sm:px-6 sm:pt-14">
      <h1 className="font-display text-[clamp(1.9rem,6vw,2.75rem)] font-bold">
        {t("checkout.title")}
      </h1>

      {/* ---- progress ---------------------------------------------------- */}
      <ol className="mt-6 flex items-center gap-2" aria-label={t("checkout.title")}>
        {steps.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              aria-current={i === step ? "step" : undefined}
              className={clsx(
                "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                i < step
                  ? "bg-rust text-onrust"
                  : i === step
                    ? "bg-rust text-onrust ring-4 ring-rust/20"
                    : "border border-line bg-surface text-char/50",
              )}
            >
              {i < step ? "✓" : i + 1}
            </span>
            <span
              className={clsx(
                "hidden text-sm font-semibold sm:block",
                i === step ? "text-char" : "text-char/50",
              )}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <span aria-hidden="true" className="h-px flex-1 bg-line" />
            )}
          </li>
        ))}
      </ol>

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

      {/* ---- STEP 0 — cart review --------------------------------------- */}
      {step === 0 && (
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
      )}

      {/* ---- STEP 1 — details ------------------------------------------- */}
      {step === 1 && (
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
                  <label className="label" htmlFor="co-zone">
                    {t("checkout.zone")}
                  </label>
                  <select
                    id="co-zone"
                    value={zoneId ?? ""}
                    onChange={(e) => setZone(e.target.value || null)}
                    required
                    className="field"
                  >
                    <option value="">{t("checkout.zoneSelect")}</option>
                    {ALL_ZONES.map((z) => (
                      <option key={z.id} value={z.id}>
                        {pick(z.el, z.en)} — {t("location.zoneMinimum")}{" "}
                        {money(z.minimumOrder * 100)}
                      </option>
                    ))}
                  </select>
                  {zone && (
                    <p className="mt-1.5 text-xs text-char/55">
                      {t("location.zoneFee")}:{" "}
                      {zone.deliveryFee === 0
                        ? t("location.zoneFree")
                        : money(zone.deliveryFee * 100)}{" "}
                      · ~{zone.etaMinutes} {t("menu.minutes")}
                    </p>
                  )}
                </div>

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
      )}

      {/* ---- STEP 2 — payment ------------------------------------------- */}
      {step === 2 && (
        <section className="mt-8 space-y-6" aria-label={t("checkout.step.payment")}>
          {DEMO_MODE && (
            <p
              role="note"
              className="rounded-card border border-gold/50 bg-gold/10 p-4 text-sm font-semibold"
            >
              {locale === "en"
                ? "Demo payment: pick any method, it succeeds instantly. Nothing is charged and no card or bank details are asked for."
                : "Δοκιμαστική πληρωμή: διάλεξε οποιαδήποτε μέθοδο, θα πετύχει αμέσως. Δεν γίνεται χρέωση και δεν ζητάμε στοιχεία κάρτας ή τράπεζας."}
            </p>
          )}
          <fieldset className="card p-5">
            <legend className="label px-1">{t("checkout.paymentMethod")}</legend>
            <div className="space-y-2">
              {(
                [
                  { id: "iris", label: t("checkout.payIris"), help: t("checkout.payIrisHelp"), recommended: true },
                  { id: "card", label: t("checkout.payCard"), help: t("checkout.payCardHelp") },
                  { id: "cash", label: t("checkout.payCash"), help: t("checkout.payCashHelp") },
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
                    <span className="flex items-center gap-2 font-semibold">
                      {m.label}
                      {"recommended" in m && m.recommended && (
                        <span className="rounded-full bg-rust/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-rust">
                          {t("checkout.recommended")}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-sm text-char/60">{m.help}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Age gate — only rendered when the cart actually contains alcohol. */}
          {hasAgeGated && (
            <fieldset className="card border-rust/40 p-5">
              <legend className="label px-1 text-rust">{t("checkout.ageTitle")}</legend>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={(e) => setAgeConfirmed(e.target.checked)}
                  className="mt-0.5 size-5 shrink-0 accent-[rgb(var(--rouveraki-rust-rgb))]"
                />
                <span>
                  <span className="font-semibold">{t("checkout.ageCheckbox")}</span>
                  <span className="mt-1 block text-sm text-char/65">
                    {t("checkout.ageHelp")}
                  </span>
                </span>
              </label>
            </fieldset>
          )}

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
            {fulfillmentType === "delivery" && (
              <div className="flex justify-between">
                <dt className="text-char/70">{t("cart.deliveryFee")}</dt>
                <dd className="font-semibold">
                  {totals.deliveryFeeCents === 0
                    ? t("location.zoneFree")
                    : money(totals.deliveryFeeCents)}
                </dd>
              </div>
            )}
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
      )}

      {/* ---- sticky action bar ------------------------------------------ */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-sand/95 backdrop-blur-md"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={step === 0 ? () => router.push("/menu") : goBack}
            className="btn-secondary px-5"
          >
            {t("checkout.back")}
          </button>

          {step < 2 ? (
            <button type="button" onClick={goNext} className="btn-primary flex-1">
              {t("checkout.continue")} · {money(totals.totalCents)}
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting || (clock !== null && !clock.shop)}
              className="btn-primary flex-1 disabled:pointer-events-none disabled:opacity-60"
            >
              {submitting
                ? <><span className="loader" aria-hidden="true" /> {t("checkout.submitting")}</>
                : paymentMethod === "cash"
                  ? t("checkout.submitCash")
                  : `${t("checkout.submit")} · ${money(totals.totalCents)}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Maps the API's error codes onto something a customer can act on. */
function serverErrorMessage(
  code: string | undefined,
  t: (k: never) => string,
  money: (c: number) => string,
  data: { minimumCents?: number },
): string {
  const tr = t as unknown as (k: string) => string;
  switch (code) {
    case "rate_limited":
      return tr("checkout.error.rateLimited");
    case "age_verification_required":
      return tr("checkout.error.age");
    case "alcohol_hours_blocked":
      return tr("checkout.alcoholHoursBlocked");
    case "below_minimum":
      return `${tr("checkout.error.minimum")} ${data.minimumCents ? money(data.minimumCents) : ""}`.trim();
    case "delivery_closed":
      return tr("checkout.deliveryClosed");
    case "shop_closed":
      return tr("checkout.shopClosed");
    case "invalid_phone":
      return tr("checkout.error.phone");
    case "address_required":
    case "invalid_zone":
      return tr("checkout.error.address");
    default:
      return tr("checkout.error.generic");
  }
}
