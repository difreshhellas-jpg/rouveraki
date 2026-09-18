"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { useI18n } from "@/i18n/LanguageProvider";
import { CATEGORIES } from "@/lib/brand";
import { formatEuro } from "@/lib/money";
import type { MenuItemDTO } from "@/lib/menu-types";
import { useCart } from "@/store/cart";
import ItemThumb from "./ItemThumb";
import Tilt from "./Tilt";
import dynamic from "next/dynamic";

// Loaded on first tap, not on first paint. The drawer library is dead weight
// for a visitor who only scrolls the menu.
const ItemSheet = dynamic(() => import("./ItemSheet"), { ssr: false });
import { useToast } from "./Toaster";
import { Plus, Check } from "@phosphor-icons/react";

export default function MenuBrowser({ items }: { items: MenuItemDTO[] }) {
  const { t, pick, locale } = useI18n();
  const addLine = useCart((s) => s.addLine);
  const { toast } = useToast();

  const [active, setActive] = useState<string>(CATEGORIES[0].slug);
  const [query, setQuery] = useState("");
  const [openItem, setOpenItem] = useState<MenuItemDTO | null>(null);
  const [justAdded, setJustAdded] = useState<number | null>(null);

  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const railRef = useRef<HTMLDivElement>(null);
  // Set while a pill click is scrolling, so the observer does not fight it.
  const suppressObserver = useRef(false);

  const money = (cents: number) =>
    formatEuro(cents / 100, locale === "en" ? "en-IE" : "el-GR");

  /* ---- search ---------------------------------------------------------- */
  const normalized = query.trim().toLocaleLowerCase(locale === "en" ? "en" : "el");

  const filtered = useMemo(() => {
    if (!normalized) return items;
    return items.filter((i) =>
      [i.name, i.nameEn, i.description, i.descriptionEn]
        .filter(Boolean)
        .some((f) =>
          f!.toLocaleLowerCase(locale === "en" ? "en" : "el").includes(normalized),
        ),
    );
  }, [items, normalized, locale]);

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItemDTO[]>();
    for (const c of CATEGORIES) map.set(c.slug, []);
    for (const item of filtered) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    }
    return map;
  }, [filtered]);

  const visibleCategories = CATEGORIES.filter(
    (c) => (grouped.get(c.slug)?.length ?? 0) > 0,
  );

  /* ---- active pill follows the scroll position ------------------------- */
  useEffect(() => {
    if (normalized) return; // no section highlighting while searching

    const observer = new IntersectionObserver(
      (entries) => {
        if (suppressObserver.current) return;
        // Pick the entry closest to the top of the viewport that is intersecting.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          const slug = visible[0].target.getAttribute("data-category");
          if (slug) setActive(slug);
        }
      },
      {
        // The sticky header plus the pill rail occupy roughly the top 140px;
        // a section counts as "current" once it clears that band.
        rootMargin: "-140px 0px -65% 0px",
        threshold: 0,
      },
    );

    for (const el of sectionRefs.current.values()) observer.observe(el);
    return () => observer.disconnect();
  }, [normalized, visibleCategories.length]);

  /* ---- keep the active pill in view on the rail ------------------------ */
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const pill = rail.querySelector<HTMLElement>(`[data-pill="${active}"]`);
    if (!pill) return;
    const left = pill.offsetLeft - rail.offsetWidth / 2 + pill.offsetWidth / 2;
    rail.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [active]);

  const jumpTo = (slug: string) => {
    const el = sectionRefs.current.get(slug);
    if (!el) return;
    setActive(slug);
    suppressObserver.current = true;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      suppressObserver.current = false;
    }, 700);
  };

  const quickAdd = (item: MenuItemDTO) => {
    addLine({
      menuItemId: item.id,
      name: item.name,
      nameEn: item.nameEn,
      unitPriceCents: item.priceCents,
      quantity: 1,
      itemNotes: "",
      requiresAgeVerification: item.requiresAgeVerification,
      image: item.image,
      category: item.category,
    });
    toast(pick(item.name, item.nameEn), { variant: "success" });
    setJustAdded(item.id);
    window.setTimeout(() => setJustAdded((v) => (v === item.id ? null : v)), 1400);
  };

  return (
    <>
      {/* ---- sticky category rail ---------------------------------------- */}
      <div className="sticky top-[3.75rem] z-40 border-b border-line bg-sand/95 backdrop-blur-md">
        <div className="mx-auto max-w-content px-4 sm:px-6">
          <div
            ref={railRef}
            role="tablist"
            aria-label={t("menu.categoryNav")}
            className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-3"
          >
            {visibleCategories.map((c) => (
              <button
                key={c.slug}
                data-pill={c.slug}
                role="tab"
                aria-selected={active === c.slug}
                type="button"
                onClick={() => jumpTo(c.slug)}
                className={clsx(
                  "min-h-touch shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors",
                  active === c.slug && !normalized
                    ? "bg-rust text-onrust"
                    : "border border-line bg-surface text-char/75 hover:text-char",
                )}
              >
                {pick(c.el, c.en)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---- search ------------------------------------------------------ */}
      <div className="mx-auto max-w-content px-4 pt-6 sm:px-6">
        <label className="sr-only" htmlFor="menu-search">
          {t("menu.searchPlaceholder")}
        </label>
        <input
          id="menu-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("menu.searchPlaceholder")}
          className="field max-w-md"
        />
      </div>

      {/* ---- sections ---------------------------------------------------- */}
      <div className="mx-auto max-w-content px-4 pb-40 sm:px-6">
        {visibleCategories.length === 0 && (
          <p className="py-16 text-center text-char/60">{t("menu.empty")}</p>
        )}

        {visibleCategories.map((c) => (
          <section
            key={c.slug}
            id={c.slug}
            data-category={c.slug}
            ref={(el) => {
              if (el) sectionRefs.current.set(c.slug, el);
              else sectionRefs.current.delete(c.slug);
            }}
            className="scroll-mt-36 pt-10"
            aria-labelledby={`heading-${c.slug}`}
          >
            <h2
              id={`heading-${c.slug}`}
              className="font-display text-2xl font-bold sm:text-3xl"
            >
              {pick(c.el, c.en)}
            </h2>
            <div className="tex-rope mt-3 w-16" />

            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {grouped.get(c.slug)!.map((item) => {
                const name = pick(item.name, item.nameEn);
                const desc = pick(item.description ?? "", item.descriptionEn);
                return (
                  <Tilt as="li" key={item.id} className="rounded-card">
                    {/* The <li> is the tilting object; the card inside is the
                        button, so the 3D transform never fights the press
                        scale. The whole card opens the detail sheet; the add
                        button inside stops propagation for a one-tap add. */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setOpenItem(item)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setOpenItem(item);
                        }
                      }}
                      aria-haspopup="dialog"
                      className={clsx(
                        "card card-tappable flex h-full cursor-pointer items-stretch gap-4 overflow-hidden p-3 text-left",
                        !item.available && "opacity-55",
                      )}
                    >
                      <ItemThumb
                        item={item}
                        alt={name}
                        className="size-28 shrink-0 sm:size-32"
                      />

                      <div className="flex min-w-0 flex-1 flex-col py-0.5">
                        <div className="flex items-start gap-2">
                          <h3 className="font-display text-lg font-semibold leading-snug">
                            {name}
                          </h3>
                          {item.requiresAgeVerification && (
                            <span className="mt-1 shrink-0 rounded-full bg-accent/12 px-2 py-0.5 text-[0.65rem] font-bold text-accent">
                              {t("menu.ageGated")}
                            </span>
                          )}
                        </div>

                        {desc && (
                          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-stone">
                            {desc}
                          </p>
                        )}

                        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                          <span className="font-display text-lg font-semibold tabular-nums text-accent">
                            {money(item.priceCents)}
                          </span>

                          {item.available ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                quickAdd(item);
                              }}
                              aria-label={`${t("menu.add")} ${name}`}
                              className={clsx(
                                "inline-flex size-touch items-center justify-center rounded-full text-lg font-bold transition-colors",
                                justAdded === item.id
                                  ? "bg-emerald-600 text-white"
                                  : "bg-accent text-onaccent shadow-accent hover:bg-accentBright",
                              )}
                            >
                              {justAdded === item.id ? <Check size={18} weight="bold" /> : <Plus size={18} weight="bold" />}
                            </button>
                          ) : (
                            <span className="text-xs font-semibold uppercase tracking-wide text-char/50">
                              {t("menu.unavailable")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Tilt>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      <ItemSheet item={openItem} onClose={() => setOpenItem(null)} />
    </>
  );
}
