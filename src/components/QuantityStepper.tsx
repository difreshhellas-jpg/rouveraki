"use client";

import { useI18n } from "@/i18n/LanguageProvider";

/**
 * Minus / value / plus. Every hit area is 44px, which is the whole point of
 * having this as a component rather than two inline buttons.
 */
export default function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 30,
  label,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  label?: string;
}) {
  const { t } = useI18n();
  // 44px everywhere — the stepper is a primary thumb target, in the cart
  // list as much as in the item sheet.
  const dim = "size-touch";

  return (
    <div
      className="inline-flex items-center rounded-full border border-line bg-surface"
      role="group"
      aria-label={label ?? t("menu.quantity")}
    >
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={t("menu.decrease")}
        className={`${dim} inline-flex items-center justify-center rounded-full text-lg font-bold text-char transition-colors hover:bg-char/5 disabled:opacity-35`}
      >
        &minus;
      </button>
      <span
        className="min-w-8 text-center text-base font-bold tabular-nums"
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={t("menu.increase")}
        className={`${dim} inline-flex items-center justify-center rounded-full text-lg font-bold text-char transition-colors hover:bg-char/5 disabled:opacity-35`}
      >
        +
      </button>
    </div>
  );
}
