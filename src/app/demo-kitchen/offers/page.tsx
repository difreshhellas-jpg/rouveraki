"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import clsx from "clsx";
import { readAdminKey } from "@/lib/admin-key";
import { athensToday, type Offer, type OfferDeal, type Recommendation } from "@/lib/offer-types";
import { CATEGORIES } from "@/lib/brand";
import { formatEuro } from "@/lib/money";
import type { MenuItemDTO } from "@/lib/menu-types";
import NotificationScheduler from "./NotificationScheduler";

/**
 * The owner's offers and checkout recommendations.
 *  - Offers: add, change, show/hide, delete, photo, and send one to the
 *    customers who turned on offer notifications.
 *  - Recommendations: "Θέλεις και πατάτες;" at checkout, at normal prices.
 * Everything is saved straight to the site.
 */
type Doc = { offers: Offer[]; push: boolean; subscribers: number };
type Msg = { kind: "ok" | "error" | "busy"; text: string } | null;
type Kind = "none" | "item" | "addon" | "combo";

const blank = (): Offer => ({
  id: `o-${Date.now().toString(36)}`,
  title: "",
  titleEn: null,
  text: null,
  textEn: null,
  badge: null,
  active: true,
  endsOn: null,
  deal: null,
  image: null,
});

const money = (c: number) => formatEuro(c / 100, "el-GR");
const catLabel = (slug: string) => CATEGORIES.find((c) => c.slug === slug)?.el ?? slug;
const euros = (c: number) => (c / 100).toFixed(2).replace(".", ",");
const parseCents = (t: string) => Math.round(parseFloat(t.replace(",", ".")) * 100);

/** One line describing what the offer does to prices. */
function dealSummary(d: OfferDeal | null | undefined, menu: MenuItemDTO[]): string | null {
  if (!d) return null;
  const nameOf = (id: number) => menu.find((x) => x.id === id)?.name ?? "προϊόν που αφαιρέθηκε";
  if (d.kind === "combo") {
    const regular = d.items.reduce((n, p) => n + (menu.find((m) => m.id === p.itemId)?.priceCents ?? 0), 0);
    return `Combo: ${d.items.map((p) => nameOf(p.itemId)).join(" + ")} = ${money(d.priceCents)} αντί ${money(regular)}`;
  }
  const m = menu.find((x) => x.id === d.itemId);
  if (d.kind === "item") return `${nameOf(d.itemId)}: ${money(d.priceCents)} αντί ${m ? money(m.priceCents) : "-"}`;
  const when = d.withCategories.length ? d.withCategories.map(catLabel).join(", ") : "οποιοδήποτε προϊόν";
  return `Πρόταση στο ταμείο: ${nameOf(d.itemId)} +${money(d.priceCents)} μαζί με ${when}`;
}

/** The photo an offer shows: its own, else its product's. */
function photoOf(o: Offer, menu: MenuItemDTO[]): string | null {
  if (o.image) return o.image;
  const d = o.deal;
  if (!d) return null;
  const ids = d.kind === "combo" ? d.items.map((p) => p.itemId) : [d.itemId];
  return ids.map((id) => menu.find((m) => m.id === id)?.image).find(Boolean) ?? null;
}

const live = (o: Offer) => o.active && (!o.endsOn || o.endsOn >= athensToday());

export default function OffersManagerPage() {
  const [tab, setTab] = useState<"offers" | "recs" | "notifs">("offers");
  const [scheduleFor, setScheduleFor] = useState<string | null>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [menu, setMenu] = useState<MenuItemDTO[]>([]);
  useEffect(() => {
    fetch("/api/live-menu", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items: MenuItemDTO[] }) => setMenu(d.items))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/offers?all=1", { headers: { "x-admin-key": readAdminKey() }, cache: "no-store" });
      if (!r.ok) throw new Error();
      setDoc((await r.json()) as Doc);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => void load(), [load]);

  useEffect(() => {
    if (!msg || msg.kind === "busy") return;
    const id = window.setTimeout(() => setMsg(null), msg.kind === "ok" ? 4000 : 7000);
    return () => window.clearTimeout(id);
  }, [msg]);

  const save = async (offers: Offer[], okText: string) => {
    if (!doc) return false;
    const before = doc;
    setDoc({ ...doc, offers });
    setMsg({ kind: "busy", text: "Αποθήκευση..." });
    const res = await fetch("/api/offers", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-admin-key": readAdminKey() },
      body: JSON.stringify({ offers }),
    }).catch(() => null);
    if (res?.ok) {
      setMsg({ kind: "ok", text: okText });
      // Combo prices are worked out by the server: show what it saved.
      void load();
      return true;
    }
    setDoc(before);
    const err = ((await res?.json().catch(() => null)) as { error?: string } | null)?.error;
    setMsg({
      kind: "error",
      text:
        err === "price_not_lower"
          ? "Η τιμή προσφοράς πρέπει να είναι χαμηλότερη από την κανονική τιμή."
          : err === "unknown_item"
            ? "Ένα προϊόν δεν υπάρχει πια στο μενού."
            : "Δεν αποθηκεύτηκε. Έλεγξε τη σύνδεση και δοκίμασε ξανά.",
    });
    return false;
  };

  const send = async (o: Offer) => {
    if (!doc) return;
    const n = doc.subscribers;
    if (!window.confirm(`Αποστολή ειδοποίησης «${o.title}» σε ${n} ${n === 1 ? "πελάτη" : "πελάτες"};`)) return;
    setMsg({ kind: "busy", text: "Αποστολή..." });
    const res = await fetch("/api/offers/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": readAdminKey() },
      body: JSON.stringify({ id: o.id }),
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { sent?: number; failed?: number; error?: string } | null;
    if (res?.ok) {
      const failed = body?.failed ? ` (${body.failed} δεν απάντησαν, θα ξαναδοκιμαστούν στην επόμενη)` : "";
      setMsg({ kind: "ok", text: `Στάλθηκε σε ${body?.sent ?? 0} ${body?.sent === 1 ? "συσκευή" : "συσκευές"}${failed}.` });
      void load();
    } else {
      setMsg({
        kind: "error",
        text: body?.error === "rate_limited" ? "Πολλές αποστολές. Δοκίμασε σε λίγο." : "Δεν στάλθηκε. Δοκίμασε ξανά.",
      });
    }
  };

  const offers = doc?.offers ?? [];

  return (
    <div className="min-h-svh bg-sand pb-24">
      <div className="mx-auto max-w-4xl px-4 py-6">
        <header className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-bold">
            Προσφορές <span className="text-char/50">στο site</span>
          </h1>
          <div className="flex flex-wrap gap-2 sm:ml-auto">
            <Link href="/demo-kitchen" className="btn-secondary text-sm">
              Παραγγελίες
            </Link>
            {tab === "offers" && (
              <button type="button" className="btn-primary text-sm" disabled={!doc} onClick={() => setEditing(blank())}>
                + Νέα προσφορά
              </button>
            )}
          </div>
        </header>

        <div role="tablist" className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ["offers", `🏷️ Προσφορές (${offers.length})`],
              ["recs", "🛒 Προτάσεις ταμείου"],
              ["notifs", "⏰ Ειδοποιήσεις"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={clsx(
                "whitespace-nowrap rounded-full border-2 px-4 py-2 text-sm font-semibold",
                tab === k ? "border-rust bg-rust text-onrust" : "border-line",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {msg && (
          <p
            role={msg.kind === "error" ? "alert" : "status"}
            className={clsx(
              "mt-4 rounded-card p-3 text-sm font-semibold",
              msg.kind === "error" ? "bg-rust/10 text-rust" : "bg-gold/15",
            )}
          >
            {msg.text}
          </p>
        )}

        {tab === "recs" ? (
          <RecommendationsManager menu={menu} setMsg={setMsg} />
        ) : tab === "notifs" ? (
          <NotificationScheduler
            offers={offers.filter(live)}
            subscribers={doc?.subscribers ?? 0}
            preselect={scheduleFor}
            setMsg={setMsg}
          />
        ) : (
          <>
            <p className="mt-4 text-sm text-char/65">
              Οι ενεργές προσφορές φαίνονται ως banner στην αρχική και στο μενού, με φωτογραφία. Μια προσφορά
              μπορεί να κατεβάσει την τιμή ενός προϊόντος, να είναι combo (π.χ. πίτα + πατάτες + αναψυκτικό σε
              μία τιμή) ή να προτείνει κάτι στο ταμείο (π.χ. «Θέλεις και Coca-Cola; μόνο +1,50 €»).
            </p>
            {doc && (
              <p className="mt-2 text-sm font-semibold">
                {doc.push
                  ? `🔔 ${doc.subscribers} ${doc.subscribers === 1 ? "πελάτης έχει" : "πελάτες έχουν"} ενεργές ειδοποιήσεις προσφορών.`
                  : "🔕 Οι ειδοποιήσεις στο κινητό των πελατών δεν έχουν ρυθμιστεί ακόμα (χρειάζονται τα κλειδιά VAPID στο Vercel)."}
              </p>
            )}

            {failed && (
              <p className="mt-6 rounded-card border border-rust/30 bg-rust/10 p-4 text-sm text-rust">
                Δεν φορτώθηκαν οι προσφορές.{" "}
                <button type="button" className="underline" onClick={() => void load()}>
                  Δοκίμασε ξανά
                </button>
              </p>
            )}

            {editing && (
              <OfferForm
                offer={editing}
                menu={menu}
                isNew={!offers.some((o) => o.id === editing.id)}
                onCancel={() => setEditing(null)}
                onSave={async (o) => {
                  const exists = offers.some((x) => x.id === o.id);
                  const next = exists ? offers.map((x) => (x.id === o.id ? o : x)) : [o, ...offers];
                  if (await save(next, exists ? "Η προσφορά άλλαξε." : "Η προσφορά δημοσιεύτηκε στο site."))
                    setEditing(null);
                }}
              />
            )}

            {doc && offers.length === 0 && !editing && (
              <p className="mt-6 rounded-card border border-dashed border-line p-8 text-center text-sm text-char/55">
                Δεν υπάρχει καμία προσφορά. Πάτα «+ Νέα προσφορά».
              </p>
            )}

            <ul className="mt-6 space-y-3">
              {offers.map((o) => {
                const photo = photoOf(o, menu);
                return (
                  <li key={o.id} className={clsx("card p-4", !live(o) && "opacity-60")}>
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-gold to-rust">
                        {photo && <Image src={photo} alt="" fill sizes="64px" className="object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-lg font-semibold">
                          {o.badge && (
                            <span className="mr-2 rounded-full bg-rust px-2 py-0.5 text-sm text-onrust">{o.badge}</span>
                          )}
                          {o.title}
                        </p>
                        {o.text && <p className="mt-1 whitespace-pre-line text-sm text-char/70">{o.text}</p>}
                        {o.deal && (
                          <p className="mt-1 text-sm font-semibold text-rust">💶 {dealSummary(o.deal, menu)}</p>
                        )}
                        <p className="mt-1 text-xs font-semibold text-char/55">
                          {live(o) ? "● Φαίνεται στο site" : o.active ? "Έληξε" : "Κρυφή"}
                          {o.endsOn && ` · έως ${o.endsOn.split("-").reverse().join("/")}`}
                        </p>
                      </div>
                      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                        <button
                          type="button"
                          className={o.active ? "btn-secondary text-sm" : "btn-primary text-sm"}
                          onClick={() =>
                            void save(
                              offers.map((x) => (x.id === o.id ? { ...x, active: !x.active } : x)),
                              o.active ? "Η προσφορά κρύφτηκε." : "Η προσφορά φαίνεται ξανά.",
                            )
                          }
                        >
                          {o.active ? "Απόκρυψη" : "Εμφάνιση"}
                        </button>
                        <button type="button" className="btn-secondary text-sm" onClick={() => setEditing(o)}>
                          Αλλαγή
                        </button>
                        {doc?.push && live(o) && (
                          <button type="button" className="btn-primary text-sm" onClick={() => void send(o)}>
                            🔔 Ειδοποίηση
                          </button>
                        )}
                        {doc?.push && live(o) && (
                          <button
                            type="button"
                            className="btn-secondary text-sm"
                            onClick={() => {
                              setScheduleFor(o.id);
                              setTab("notifs");
                            }}
                          >
                            ⏰ Προγραμματισμός
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-secondary text-sm text-rust"
                          onClick={() => {
                            if (window.confirm(`Διαγραφή της προσφοράς «${o.title}»;`))
                              void save(
                                offers.filter((x) => x.id !== o.id),
                                "Η προσφορά διαγράφηκε.",
                              );
                          }}
                        >
                          Διαγραφή
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

/** Menu products grouped by category, for a <select>. */
function ProductOptions({ menu }: { menu: MenuItemDTO[] }) {
  return (
    <>
      {CATEGORIES.map((c) => {
        const list = menu.filter((m) => m.category === c.slug);
        return list.length ? (
          <optgroup key={c.slug} label={c.el}>
            {list.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({money(m.priceCents)}){m.available ? "" : " - εξαντλημένο"}
              </option>
            ))}
          </optgroup>
        ) : null;
      })}
    </>
  );
}

function OfferForm({
  offer,
  menu,
  isNew,
  onSave,
  onCancel,
}: {
  offer: Offer;
  menu: MenuItemDTO[];
  isNew: boolean;
  onSave: (o: Offer) => Promise<void>;
  onCancel: () => void;
}) {
  const [o, setO] = useState(offer);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Offer>) => setO((prev) => ({ ...prev, ...patch }));
  const str = (v: string) => (v.trim() ? v : null);
  const d = o.deal ?? null;
  const kind: Kind = d?.kind ?? "none";
  const firstId = menu.find((m) => m.available)?.id ?? menu[0]?.id ?? 0;

  // Typed in euros; kept as text so "2," can be typed on the way to "2,50".
  const [priceText, setPriceText] = useState(d ? euros(d.priceCents) : "");
  const cents = parseCents(priceText);
  const item = d && d.kind !== "combo" ? menu.find((m) => m.id === d.itemId) : undefined;
  const comboIds = d?.kind === "combo" ? d.items.map((p) => p.itemId) : [];
  const comboRegular = comboIds.reduce((n, id) => n + (menu.find((m) => m.id === id)?.priceCents ?? 0), 0);
  const priceOk =
    Number.isFinite(cents) &&
    cents >= 0 &&
    (kind !== "item" || !item || cents < item.priceCents) &&
    (kind !== "combo" || (comboIds.length >= 2 && cents < comboRegular));

  const setKind = (k: Kind) => {
    const itemId = d && d.kind !== "combo" ? d.itemId : firstId;
    set({
      deal:
        k === "none"
          ? null
          : k === "item"
            ? { kind: "item", itemId, priceCents: 0 }
            : k === "addon"
              ? { kind: "addon", itemId, priceCents: 0, withCategories: [] }
              : { kind: "combo", items: [firstId, firstId].map((id) => ({ itemId: id, priceCents: 0 })), priceCents: 0 },
    });
  };
  const setCombo = (ids: number[]) =>
    set({ deal: { kind: "combo", items: ids.map((id) => ({ itemId: id, priceCents: 0 })), priceCents: 0 } });
  const withCats = d?.kind === "addon" ? d.withCategories : [];
  const photos = menu.filter((m) => m.image);
  const autoPhoto = photoOf({ ...o, image: null }, menu);
  const shownPhoto = o.image || autoPhoto;
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const upload = async (file: File) => {
    setUploading(true);
    setUploadErr(null);
    try {
      const body = new FormData();
      body.append("file", await shrinkPhoto(file));
      const res = await fetch("/api/offers/image", {
        method: "POST",
        headers: { "x-admin-key": readAdminKey() },
        body,
      });
      const j = (await res.json().catch(() => ({}))) as { url?: string };
      if (!res.ok || !j.url) throw new Error();
      set({ image: j.url });
    } catch {
      setUploadErr("Η φωτογραφία δεν ανέβηκε. Δοκίμασε άλλη (JPG, PNG ή WebP).");
    } finally {
      setUploading(false);
    }
  };

  return (
    <form
      className="card mt-6 space-y-4 border-2 border-gold p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const deal = d ? { ...d, priceCents: cents } : null;
        await onSave({ ...o, title: o.title.trim(), deal });
        setBusy(false);
      }}
    >
      <h2 className="font-display text-xl font-bold">{isNew ? "Νέα προσφορά" : "Αλλαγή προσφοράς"}</h2>
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <div>
          <label className="label" htmlFor="of-title">
            Τίτλος *
          </label>
          <input
            id="of-title"
            className="field"
            required
            maxLength={80}
            value={o.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="π.χ. Γύρος + αναψυκτικό"
          />
        </div>
        <div>
          <label className="label" htmlFor="of-badge">
            Σήμα
          </label>
          <input
            id="of-badge"
            className="field"
            maxLength={16}
            value={o.badge ?? ""}
            onChange={(e) => set({ badge: str(e.target.value) })}
            placeholder="-20% ή 2+1"
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="of-text">
          Περιγραφή
        </label>
        <textarea
          id="of-text"
          className="field min-h-[5rem]"
          maxLength={400}
          value={o.text ?? ""}
          onChange={(e) => set({ text: str(e.target.value) })}
          placeholder="π.χ. Κάθε μέρα 13:00-17:00, μόνο για παραλαβή."
        />
      </div>

      <fieldset className="space-y-3 rounded-card border border-line p-4">
        <legend className="px-1 text-sm font-semibold">Τιμή</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["none", "Μόνο ανακοίνωση", "Δεν αλλάζει καμία τιμή."],
              ["item", "Ειδική τιμή προϊόντος", "Το προϊόν κοστίζει λιγότερο για όλους."],
              ["combo", "Combo", "Πολλά προϊόντα μαζί σε μία τιμή."],
              ["addon", "Πρόταση στο ταμείο", "π.χ. «Θέλεις και Coca-Cola; μόνο +1,50 €»"],
            ] as const
          ).map(([k, label, help]) => (
            <label
              key={k}
              className={clsx(
                "cursor-pointer rounded-xl border-2 p-3 text-sm",
                kind === k ? "border-rust bg-rust/5" : "border-line",
              )}
            >
              <input type="radio" name="of-kind" className="sr-only" checked={kind === k} onChange={() => setKind(k)} />
              <span className="block font-semibold">{label}</span>
              <span className="text-char/60">{help}</span>
            </label>
          ))}
        </div>

        {d && d.kind !== "combo" && (
          <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
            <div>
              <label className="label" htmlFor="of-item">
                {kind === "addon" ? "Τι προτείνουμε" : "Προϊόν"}
              </label>
              <select
                id="of-item"
                className="field"
                value={d.itemId}
                onChange={(e) => set({ deal: { ...d, itemId: Number(e.target.value) } })}
              >
                <ProductOptions menu={menu} />
              </select>
            </div>
            <div>
              <label className="label" htmlFor="of-price">
                {kind === "addon" ? "Τιμή μαζί (€)" : "Τιμή προσφοράς (€)"}
              </label>
              <input
                id="of-price"
                className="field"
                inputMode="decimal"
                required
                value={priceText}
                onChange={(e) => setPriceText(e.target.value)}
                placeholder="2,00"
              />
            </div>
          </div>
        )}

        {d?.kind === "combo" && (
          <div className="space-y-3">
            <p className="label">Προϊόντα του combo (2 έως 6)</p>
            {comboIds.map((id, i) => (
              <div key={i} className="flex gap-2">
                <select
                  aria-label={`Προϊόν ${i + 1}`}
                  className="field"
                  value={id}
                  onChange={(e) => setCombo(comboIds.map((x, j) => (j === i ? Number(e.target.value) : x)))}
                >
                  <ProductOptions menu={menu} />
                </select>
                {comboIds.length > 2 && (
                  <button
                    type="button"
                    aria-label="Αφαίρεση προϊόντος"
                    className="btn-secondary shrink-0 !px-4"
                    onClick={() => setCombo(comboIds.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {comboIds.length < 6 && (
              <button type="button" className="btn-secondary text-sm" onClick={() => setCombo([...comboIds, firstId])}>
                + Προϊόν
              </button>
            )}
            <div className="grid gap-4 sm:grid-cols-[1fr_9rem] sm:items-end">
              <p className="text-sm text-char/65">
                Χωριστά κοστίζουν <strong>{money(comboRegular)}</strong>. Η τιμή του combo πρέπει να είναι μικρότερη.
              </p>
              <div>
                <label className="label" htmlFor="of-price">
                  Τιμή combo (€)
                </label>
                <input
                  id="of-price"
                  className="field"
                  inputMode="decimal"
                  required
                  value={priceText}
                  onChange={(e) => setPriceText(e.target.value)}
                  placeholder="8,00"
                />
              </div>
            </div>
          </div>
        )}

        {d && priceText && !priceOk && (
          <p className="text-sm font-semibold text-rust">
            {kind === "combo"
              ? `Η τιμή του combo πρέπει να είναι μικρότερη από ${money(comboRegular)}.`
              : item
                ? `Η τιμή προσφοράς πρέπει να είναι μικρότερη από ${money(item.priceCents)}.`
                : "Έλεγξε την τιμή."}
          </p>
        )}

        {d?.kind === "addon" && (
          <div>
            <p className="label">Προτείνεται όταν το καλάθι έχει (κανένα επιλεγμένο = οτιδήποτε)</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => {
                const on = withCats.includes(c.slug);
                return (
                  <button
                    key={c.slug}
                    type="button"
                    onClick={() =>
                      set({
                        deal: {
                          ...d,
                          withCategories: on ? withCats.filter((x) => x !== c.slug) : [...withCats, c.slug],
                        },
                      })
                    }
                    className={clsx(
                      "rounded-full border px-3 py-1.5 text-sm",
                      on ? "border-rust bg-rust text-onrust" : "border-line",
                    )}
                  >
                    {c.el}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-char/55">Μία φορά για κάθε τέτοιο προϊόν στην παραγγελία.</p>
          </div>
        )}
      </fieldset>

      <fieldset className="rounded-card border border-line p-4">
        <legend className="px-1 text-sm font-semibold">Φωτογραφία banner</legend>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-gold to-rust sm:w-56">
            {shownPhoto && <Image src={shownPhoto} alt="" fill sizes="224px" className="object-cover" />}
            {o.badge && (
              <span className="absolute left-2 top-2 rounded-full bg-rust px-2 py-0.5 text-xs font-bold text-onrust">
                {o.badge}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <label className="label" htmlFor="of-image">
              Ποια φωτογραφία
            </label>
            <select
              id="of-image"
              className="field"
              value={o.image ?? ""}
              onChange={(e) => set({ image: e.target.value || null })}
            >
              <option value="">Αυτόματα: η φωτογραφία του προϊόντος</option>
              {o.image && !photos.some((m) => m.image === o.image) && (
                <option value={o.image}>📷 Η δική σου φωτογραφία</option>
              )}
              {CATEGORIES.map((c) => {
                const list = photos.filter((m) => m.category === c.slug);
                return list.length ? (
                  <optgroup key={c.slug} label={c.el}>
                    {list.map((m) => (
                      <option key={m.id} value={m.image!}>
                        {m.name}
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })}
            </select>
            <label
              className={`btn-secondary mt-3 inline-flex cursor-pointer text-sm ${uploading ? "pointer-events-none opacity-60" : ""}`}
            >
              {uploading ? "Ανεβαίνει…" : "📷 Ανέβασε δική σου φωτογραφία"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void upload(f);
                }}
              />
            </label>
            {uploadErr && (
              <p role="alert" className="mt-1 text-xs font-semibold text-red-700 dark:text-red-400">
                {uploadErr}
              </p>
            )}
            <p className="mt-1 text-xs text-char/55">
              Καλύτερα οριζόντια φωτογραφία. Χωρίς φωτογραφία φαίνεται χρωματιστό φόντο με το σήμα.
            </p>
          </div>
        </div>
      </fieldset>

      <details className="rounded-card border border-line p-3">
        <summary className="cursor-pointer text-sm font-semibold">Στα αγγλικά (προαιρετικό)</summary>
        <div className="mt-3 space-y-3">
          <input
            aria-label="English title"
            className="field"
            maxLength={80}
            value={o.titleEn ?? ""}
            onChange={(e) => set({ titleEn: str(e.target.value) })}
            placeholder="Title in English"
          />
          <textarea
            aria-label="English description"
            className="field min-h-[4rem]"
            maxLength={400}
            value={o.textEn ?? ""}
            onChange={(e) => set({ textEn: str(e.target.value) })}
            placeholder="Description in English"
          />
        </div>
      </details>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="label" htmlFor="of-ends">
            Λήγει (προαιρετικό)
          </label>
          <input
            id="of-ends"
            type="date"
            lang="el"
            className="field"
            min={athensToday()}
            value={o.endsOn ?? ""}
            onChange={(e) => set({ endsOn: e.target.value || null })}
          />
        </div>
        <label className="flex items-center gap-2 pb-3 text-sm font-semibold">
          <input type="checkbox" checked={o.active} onChange={(e) => set({ active: e.target.checked })} />
          Να φαίνεται στο site
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={busy || !o.title.trim() || (!!d && (!priceOk || !priceText))}>
          {busy ? "Αποθήκευση..." : "Αποθήκευση"}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Άκυρο
        </button>
      </div>
    </form>
  );
}

/** Checkout recommendations: grouped by the category that triggers them. */
function RecommendationsManager({
  menu,
  setMsg,
}: {
  menu: MenuItemDTO[];
  setMsg: (m: Msg) => void;
}) {
  const [recs, setRecs] = useState<Recommendation[] | null>(null);
  const [when, setWhen] = useState<string>(CATEGORIES[0].slug);
  const [itemId, setItemId] = useState<number>(0);

  useEffect(() => {
    fetch("/api/recommendations?all=1", { headers: { "x-admin-key": readAdminKey() }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { recs: Recommendation[] } | null) => setRecs(d?.recs ?? []))
      .catch(() => setRecs([]));
  }, []);
  useEffect(() => {
    if (!itemId && menu.length) setItemId(menu.find((m) => m.category !== when)?.id ?? menu[0].id);
  }, [menu, itemId, when]);

  const save = async (next: Recommendation[], okText: string) => {
    const before = recs;
    setRecs(next);
    setMsg({ kind: "busy", text: "Αποθήκευση..." });
    const res = await fetch("/api/recommendations", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-admin-key": readAdminKey() },
      body: JSON.stringify({ recs: next }),
    }).catch(() => null);
    if (res?.ok) setMsg({ kind: "ok", text: okText });
    else {
      setRecs(before);
      setMsg({ kind: "error", text: "Δεν αποθηκεύτηκε. Έλεγξε τη σύνδεση και δοκίμασε ξανά." });
    }
  };

  if (!recs) return <p className="mt-6 text-sm text-char/60">Φόρτωση...</p>;
  const name = (id: number) => menu.find((m) => m.id === id);

  return (
    <div className="mt-4 space-y-5">
      <p className="text-sm text-char/65">
        Στο ταμείο ο πελάτης βλέπει έως 3 προτάσεις που ταιριάζουν με το καλάθι του (π.χ. «Θέλεις και
        Πατάτες τηγανητές; +4,00 €»), και 2 μέσα στο κάθε προϊόν του μενού. Χρεώνονται στην κανονική τιμή.
        Δεν προτείνεται ποτέ κάτι που υπάρχει ήδη στο καλάθι.
      </p>

      <form
        className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!itemId) return;
          const id = `r-${Date.now().toString(36)}`;
          void save([{ id, whenCategories: [when], itemId, active: true }, ...recs], "Η πρόταση προστέθηκε.");
        }}
      >
        <div className="flex-1">
          <label className="label" htmlFor="rec-when">
            Όταν το καλάθι έχει
          </label>
          <select id="rec-when" className="field" value={when} onChange={(e) => setWhen(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.el}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="label" htmlFor="rec-item">
            Πρότεινε
          </label>
          <select id="rec-item" className="field" value={itemId} onChange={(e) => setItemId(Number(e.target.value))}>
            <ProductOptions menu={menu} />
          </select>
        </div>
        <button type="submit" className="btn-primary shrink-0">
          + Προσθήκη
        </button>
      </form>

      {CATEGORIES.map((c) => {
        const list = recs.filter((r) => r.whenCategories.includes(c.slug));
        if (!list.length) return null;
        return (
          <section key={c.slug} className="card p-4">
            <h3 className="font-display text-lg font-semibold">
              {c.el} <span className="text-sm font-normal text-char/75">→ προτείνουμε</span>
            </h3>
            <ul className="mt-2 divide-y divide-line">
              {list.map((r) => {
                const m = name(r.itemId);
                return (
                  <li key={r.id} className={clsx("flex flex-wrap items-center gap-3 py-2.5", !r.active && "opacity-50")}>
                    <span className="min-w-0 flex-1 text-sm">
                      <strong>{m?.name ?? "προϊόν που αφαιρέθηκε"}</strong>{" "}
                      <span className="text-char/60">{m ? money(m.priceCents) : ""}</span>
                      {m && !m.available && <span className="ml-1 text-rust">(εξαντλημένο)</span>}
                    </span>
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      onClick={() =>
                        void save(
                          recs.map((x) => (x.id === r.id ? { ...x, active: !x.active } : x)),
                          r.active ? "Η πρόταση σταμάτησε." : "Η πρόταση ενεργοποιήθηκε.",
                        )
                      }
                    >
                      {r.active ? "Παύση" : "Ενεργοποίηση"}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-sm text-rust"
                      onClick={() => void save(recs.filter((x) => x.id !== r.id), "Η πρόταση διαγράφηκε.")}
                    >
                      Διαγραφή
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Makes a phone photo small enough to upload (longest side 1600 px, JPEG). */
async function shrinkPhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.84),
  );
  return new File([blob], "offer.jpg", { type: "image/jpeg" });
}
