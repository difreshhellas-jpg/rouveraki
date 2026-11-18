"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { readAdminKey } from "@/lib/admin-key";
import { athensToday, type Offer } from "@/lib/offer-types";

/**
 * The owner's offers: add, change, show/hide, delete, and send one to the
 * customers who turned on offer notifications. Saved straight to the site.
 */
type Doc = { offers: Offer[]; push: boolean; subscribers: number };
type Msg = { kind: "ok" | "error" | "busy"; text: string } | null;

const blank = (): Offer => ({
  id: `o-${Date.now().toString(36)}`,
  title: "",
  titleEn: null,
  text: null,
  textEn: null,
  badge: null,
  active: true,
  endsOn: null,
});

const live = (o: Offer) => o.active && (!o.endsOn || o.endsOn >= athensToday());

export default function OffersManagerPage() {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<Offer | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

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
      return true;
    }
    setDoc(before);
    setMsg({ kind: "error", text: "Δεν αποθηκεύτηκε. Έλεγξε τη σύνδεση και δοκίμασε ξανά." });
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
          <div className="ml-auto flex gap-2">
            <Link href="/demo-kitchen" className="btn-secondary text-sm">
              Παραγγελίες
            </Link>
            <button type="button" className="btn-primary text-sm" disabled={!doc} onClick={() => setEditing(blank())}>
              + Νέα προσφορά
            </button>
          </div>
        </header>

        <p className="mt-3 text-sm text-char/65">
          Οι ενεργές προσφορές φαίνονται στην αρχική και στο μενού, και οι πελάτες βλέπουν μια φορά ένα μικρό
          παράθυρο για κάθε νέα. Οι τιμές δεν αλλάζουν από εδώ: για έκπτωση άλλαξε την τιμή στη «Διαχείριση
          μενού».
        </p>
        {doc && (
          <p className="mt-2 text-sm font-semibold">
            {doc.push
              ? `🔔 ${doc.subscribers} ${doc.subscribers === 1 ? "πελάτης έχει" : "πελάτες έχουν"} ενεργές ειδοποιήσεις προσφορών.`
              : "🔕 Οι ειδοποιήσεις στο κινητό των πελατών δεν έχουν ρυθμιστεί ακόμα (χρειάζονται τα κλειδιά VAPID στο Vercel)."}
          </p>
        )}

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
            isNew={!offers.some((o) => o.id === editing.id)}
            onCancel={() => setEditing(null)}
            onSave={async (o) => {
              const exists = offers.some((x) => x.id === o.id);
              const next = exists ? offers.map((x) => (x.id === o.id ? o : x)) : [o, ...offers];
              if (await save(next, exists ? "Η προσφορά άλλαξε." : "Η προσφορά δημοσιεύτηκε στο site.")) setEditing(null);
            }}
          />
        )}

        {doc && offers.length === 0 && !editing && (
          <p className="mt-6 rounded-card border border-dashed border-line p-8 text-center text-sm text-char/55">
            Δεν υπάρχει καμία προσφορά. Πάτα «+ Νέα προσφορά».
          </p>
        )}

        <ul className="mt-6 space-y-3">
          {offers.map((o) => (
            <li key={o.id} className={clsx("card p-4", !live(o) && "opacity-60")}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-semibold">
                    {o.badge && (
                      <span className="mr-2 rounded-full bg-rust px-2 py-0.5 text-sm text-onrust">{o.badge}</span>
                    )}
                    {o.title}
                  </p>
                  {o.text && <p className="mt-1 whitespace-pre-line text-sm text-char/70">{o.text}</p>}
                  <p className="mt-1 text-xs font-semibold text-char/55">
                    {live(o)
                      ? "● Φαίνεται στο site"
                      : o.active
                        ? "Έληξε"
                        : "Κρυφή"}
                    {o.endsOn && ` · έως ${o.endsOn.split("-").reverse().join("/")}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
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
          ))}
        </ul>
      </div>
    </div>
  );
}

function OfferForm({
  offer,
  isNew,
  onSave,
  onCancel,
}: {
  offer: Offer;
  isNew: boolean;
  onSave: (o: Offer) => Promise<void>;
  onCancel: () => void;
}) {
  const [o, setO] = useState(offer);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Offer>) => setO((prev) => ({ ...prev, ...patch }));
  const str = (v: string) => (v.trim() ? v : null);

  return (
    <form
      className="card mt-6 space-y-4 border-2 border-gold p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave({ ...o, title: o.title.trim() });
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
        <button type="submit" className="btn-primary" disabled={busy || !o.title.trim()}>
          {busy ? "Αποθήκευση..." : "Αποθήκευση"}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Άκυρο
        </button>
      </div>
    </form>
  );
}
