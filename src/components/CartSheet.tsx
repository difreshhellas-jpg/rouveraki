"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useI18n } from "@/i18n/LanguageProvider";
import { useCart, cartTotals } from "@/store/cart";
import { formatEuro } from "@/lib/money";
import { SPRING_SHEET, EASE_EXIT } from "@/lib/motion";
import QuantityStepper from "./QuantityStepper";
import Sheet from "./Sheet";

export default function CartSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t, pick, locale } = useI18n();

  const lines = useCart((s) => s.lines);
  const fulfillmentType = useCart((s) => s.fulfillmentType);
  const zoneId = useCart((s) => s.zoneId);
  const setQuantity = useCart((s) => s.setQuantity);
  const removeLine = useCart((s) => s.removeLine);
  const clear = useCart((s) => s.clear);

  const totals = cartTotals(lines, fulfillmentType, zoneId);
  const money = (cents: number) =>
    formatEuro(cents / 100, locale === "en" ? "en-IE" : "el-GR");

  const footer =
    lines.length === 0 ? null : (
      <>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-char/70">{t("cart.subtotal")}</dt>
            <dd className="font-semibold tabular-nums">{money(totals.subtotalCents)}</dd>
          </div>
          {fulfillmentType === "delivery" && zoneId && (
            <div className="flex justify-between">
              <dt className="text-char/70">{t("cart.deliveryFee")}</dt>
              <dd className="font-semibold tabular-nums">
                {totals.deliveryFeeCents === 0
                  ? t("location.zoneFree")
                  : money(totals.deliveryFeeCents)}
              </dd>
            </div>
          )}
          <div className="flex justify-between border-t border-line pt-2 text-base">
            <dt className="font-bold">{t("cart.total")}</dt>
            <dd className="font-bold tabular-nums text-rust">
              {money(totals.totalCents)}
            </dd>
          </div>
        </dl>

        {!totals.meetsMinimum && (
          <p role="status" className="mt-3 rounded-xl bg-rust/10 p-3 text-sm text-rust">
            {t("cart.minimumNotMet")} {money(totals.minimumCents)}. {t("cart.addMore")}{" "}
            {money(totals.shortfallCents)}
          </p>
        )}

        <Link href="/checkout" onClick={onClose} className="btn-primary mt-4 w-full">
          {t("cart.checkout")}
        </Link>
        <button type="button" onClick={clear} className="btn-ghost mt-2 w-full text-sm">
          {t("cart.clear")}
        </button>
      </>
    );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("cart.title")}
      titleId="cart-sheet-title"
      footer={footer}
    >
      {lines.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-char/65">{t("cart.empty")}</p>
          <Link href="/menu" onClick={onClose} className="btn-primary mt-5">
            {t("cart.emptyCta")}
          </Link>
        </div>
      ) : (
        <ul className="px-5">
          {/* Removing a line collapses it rather than snapping the list. */}
          <AnimatePresence initial={false}>
            {lines.map((l) => (
              <motion.li
                key={l.lineId}
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0, transition: EASE_EXIT }}
                transition={SPRING_SHEET}
                className="overflow-hidden border-b border-line last:border-b-0"
              >
                <div className="flex gap-3 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug">
                      {pick(l.name, l.nameEn)}
                    </p>
                    {l.itemNotes && (
                      <p className="mt-0.5 text-sm italic text-char/60">
                        &ldquo;{l.itemNotes}&rdquo;
                      </p>
                    )}
                    <p className="mt-1 text-sm tabular-nums text-char/60">
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
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Sheet>
  );
}
