"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/LanguageProvider";
import { useCart } from "@/store/cart";
import { formatEuro } from "@/lib/money";
import type { MenuItemDTO } from "@/lib/menu-types";
import ItemThumb from "./ItemThumb";
import QuantityStepper from "./QuantityStepper";
import Sheet from "./Sheet";
import { useToast } from "./Toaster";

/** Item detail and per-item notes, in the shared sheet. */
export default function ItemSheet({
  item,
  onClose,
}: {
  item: MenuItemDTO | null;
  onClose: () => void;
}) {
  const { t, pick, locale } = useI18n();
  const addLine = useCart((s) => s.addLine);
  const { toast } = useToast();

  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  // Reset when a different item opens, so notes never leak between dishes.
  useEffect(() => {
    if (item) {
      setQuantity(1);
      setNotes("");
    }
  }, [item]);

  const money = (cents: number) =>
    formatEuro(cents / 100, locale === "en" ? "en-IE" : "el-GR");

  const add = () => {
    if (!item) return;
    addLine({
      menuItemId: item.id,
      name: item.name,
      nameEn: item.nameEn,
      unitPriceCents: item.priceCents,
      quantity,
      itemNotes: notes.trim(),
      requiresAgeVerification: item.requiresAgeVerification,
      image: item.image,
      category: item.category,
    });
    toast(`${quantity} × ${pick(item.name, item.nameEn)}`, {
      detail: notes.trim() || undefined,
      variant: "success",
    });
    onClose();
  };

  return (
    <Sheet open={Boolean(item)} onClose={onClose} titleId="item-sheet-title">
      {item && (
        <div className="flex flex-col">
          <ItemThumb
            item={item}
            alt={pick(item.name, item.nameEn)}
            sizes="(max-width: 640px) 100vw, 512px"
            className="h-44 w-full shrink-0 sm:h-52"
            rounded="rounded-none"
          />

          <div className="flex flex-col gap-5 p-5 sm:p-6">
            <div>
              <div className="flex items-start justify-between gap-4">
                <h2 id="item-sheet-title" className="font-display text-2xl font-bold">
                  {pick(item.name, item.nameEn)}
                </h2>
                <p className="shrink-0 text-xl font-bold tabular-nums text-rust">
                  {money(item.priceCents)}
                </p>
              </div>

              {item.requiresAgeVerification && (
                <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-rust/10 px-3 py-1 text-xs font-semibold text-rust">
                  <span>{t("menu.ageGated")}</span>
                  <span className="font-normal">{t("menu.ageGatedHint")}</span>
                </p>
              )}

              {pick(item.description ?? "", item.descriptionEn) && (
                <p className="mt-3 leading-relaxed text-char/75">
                  {pick(item.description ?? "", item.descriptionEn)}
                </p>
              )}

              <p className="mt-3 text-sm text-char/55">
                {t("menu.prepTime")}: ~{item.prepTimeMinutes} {t("menu.minutes")}
              </p>
            </div>

            {/* Per-item notes. The kitchen needs "no onion" attached to this
                specific line, not buried in a general order note. */}
            <div>
              <label className="label" htmlFor="item-notes">
                {t("menu.notesLabel")}{" "}
                <span className="font-normal text-char/50">
                  ({t("common.optional")})
                </span>
              </label>
              <textarea
                id="item-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={200}
                placeholder={t("menu.notesPlaceholder")}
                className="field resize-none"
              />
              <p className="mt-1.5 text-xs text-char/55">{t("menu.notesHelp")}</p>
            </div>

            <div className="flex items-center gap-3">
              <QuantityStepper value={quantity} onChange={setQuantity} />
              <button
                type="button"
                onClick={add}
                disabled={!item.available}
                className="btn-primary flex-1 disabled:pointer-events-none disabled:opacity-50"
              >
                {item.available
                  ? `${t("menu.add")} · ${money(item.priceCents * quantity)}`
                  : t("menu.unavailable")}
              </button>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}
