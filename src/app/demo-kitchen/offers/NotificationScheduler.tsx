"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { readAdminKey } from "@/lib/admin-key";
import { athensToday, type Offer } from "@/lib/offer-types";

/**
 * "Ειδοποιήσεις" tab: schedule an offer notification for later, e.g. a second
 * reminder tomorrow at 08:00, see what is waiting and what went out.
 */
type Status = "pending" | "sent" | "skipped" | "missed" | "failed";
type Item = {
  id: string;
  offerId: string;
  offerTitle: string;
  body: string | null;
  sendAt: number;
  status: Status;
  doneAt?: number;
  sent?: number;
  note?: string;
};
type Doc = { items: Item[]; lastRun: number | null; push: boolean; pinger: boolean };
type Msg = { kind: "ok" | "error" | "busy"; text: string } | null;

const when = (ms: number) =>
  new Intl.DateTimeFormat("el-GR", {
    timeZone: "Europe/Athens",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(ms);

const tomorrow = () => athensToday(new Date(Date.now() + 86_400_000));

const STATUS: Record<Exclude<Status, "pending">, string> = {
  sent: "✅ Στάλθηκε",
  skipped: "⏭️ Παραλείφθηκε",
  missed: "⚠️ Χάθηκε",
  failed: "❌ Απέτυχε",
};

export default function NotificationScheduler({
  offers,
  subscribers,
  preselect,
  setMsg,
}: {
  offers: Offer[];
  subscribers: number;
  preselect: string | null;
  setMsg: (m: Msg) => void;
}) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [failed, setFailed] = useState(false);
  const [offerId, setOfferId] = useState(preselect ?? offers[0]?.id ?? "");
  const [date, setDate] = useState(tomorrow());
  const [time, setTime] = useState("08:00");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (preselect) setOfferId(preselect);
  }, [preselect]);
  useEffect(() => {
    if (!offers.some((o) => o.id === offerId) && offers[0]) setOfferId(offers[0].id);
  }, [offers, offerId]);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications", { headers: { "x-admin-key": readAdminKey() }, cache: "no-store" });
      if (!r.ok) throw new Error();
      setDoc((await r.json()) as Doc);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  // While this tab is open it also sends what is due, then refreshes the list.
  useEffect(() => {
    const tick = async () => {
      await fetch("/api/notifications/run", { method: "POST", headers: { "x-admin-key": readAdminKey() } }).catch(
        () => null,
      );
      await load();
    };
    void tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [load]);

  const schedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerId) return;
    setBusy(true);
    setMsg({ kind: "busy", text: "Προγραμματισμός..." });
    const res = await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-key": readAdminKey() },
      body: JSON.stringify({ offerId, date, time, body: body.trim() || null }),
    }).catch(() => null);
    setBusy(false);
    const out = (await res?.json().catch(() => null)) as { item?: Item; error?: string } | null;
    if (res?.ok && out?.item) {
      setMsg({ kind: "ok", text: `Θα σταλεί ${when(out.item.sendAt)}.` });
      setBody("");
      void load();
      return;
    }
    const err = out?.error;
    setMsg({
      kind: "error",
      text:
        err === "in_past"
          ? "Η ώρα αυτή έχει ήδη περάσει. Διάλεξε μελλοντική ώρα."
          : err === "too_far"
            ? "Μέχρι 60 μέρες μπροστά."
            : err === "too_many"
              ? "Υπάρχουν ήδη 30 προγραμματισμένες. Ακύρωσε κάποια πρώτα."
              : err === "not_found"
                ? "Η προσφορά δεν υπάρχει πια."
                : "Δεν αποθηκεύτηκε. Δοκίμασε ξανά.",
    });
  };

  const cancel = async (it: Item) => {
    if (!window.confirm(`Ακύρωση της ειδοποίησης «${it.offerTitle}» (${when(it.sendAt)});`)) return;
    const res = await fetch(`/api/notifications?id=${it.id}`, {
      method: "DELETE",
      headers: { "x-admin-key": readAdminKey() },
    }).catch(() => null);
    setMsg(res?.ok ? { kind: "ok", text: "Ακυρώθηκε." } : { kind: "error", text: "Δεν ακυρώθηκε. Δοκίμασε ξανά." });
    void load();
  };

  const pending = (doc?.items ?? []).filter((i) => i.status === "pending").sort((a, b) => a.sendAt - b.sendAt);
  const done = (doc?.items ?? []).filter((i) => i.status !== "pending").sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0));
  // The outside pinger checks every 5 minutes; much longer means it is not set up or stopped.
  const stale = doc && (!doc.lastRun || Date.now() - doc.lastRun > 15 * 60_000);

  return (
    <div className="mt-4">
      <p className="text-sm text-char/65">
        Προγραμμάτισε μια ειδοποίηση για αργότερα, π.χ. μια δεύτερη υπενθύμιση αύριο στις 08:00. Πηγαίνει σε όσους
        πελάτες έχουν ενεργές ειδοποιήσεις ({subscribers}). Αν η προσφορά κρυφτεί ή λήξει μέχρι τότε, δεν στέλνεται.
      </p>

      {doc && !doc.push && (
        <p className="mt-3 rounded-card bg-rust/10 p-3 text-sm font-semibold text-rust">
          🔕 Οι ειδοποιήσεις δεν έχουν ρυθμιστεί ακόμα (χρειάζονται τα κλειδιά VAPID στο Vercel).
        </p>
      )}
      {doc && doc.push && (!doc.pinger || stale) && (
        <p className="mt-3 rounded-card bg-gold/20 p-3 text-sm font-semibold">
          ⚠️{" "}
          {!doc.pinger
            ? "Ο αυτόματος έλεγχος δεν έχει ρυθμιστεί (CRON_SECRET). Μέχρι τότε οι προγραμματισμένες στέλνονται μόνο όταν είναι ανοιχτή η εφαρμογή του καταστήματος."
            : `Ο αυτόματος έλεγχος δεν έχει τρέξει ${doc.lastRun ? `από ${when(doc.lastRun)}` : "ακόμα"}. Οι προγραμματισμένες ίσως δεν σταλούν στην ώρα τους.`}
        </p>
      )}
      {failed && (
        <p className="mt-3 rounded-card border border-rust/30 bg-rust/10 p-3 text-sm text-rust">
          Δεν φορτώθηκαν οι ειδοποιήσεις.{" "}
          <button type="button" className="underline" onClick={() => void load()}>
            Δοκίμασε ξανά
          </button>
        </p>
      )}

      {offers.length === 0 ? (
        <p className="mt-6 rounded-card border border-dashed border-line p-8 text-center text-sm text-char/55">
          Δεν υπάρχει ενεργή προσφορά για ειδοποίηση. Φτιάξε ή εμφάνισε μία στις «Προσφορές».
        </p>
      ) : (
        <form onSubmit={(e) => void schedule(e)} className="card mt-5 space-y-4 p-4">
          <h2 className="font-display text-lg font-semibold">⏰ Νέα προγραμματισμένη ειδοποίηση</h2>
          <label className="block text-sm font-semibold">
            Προσφορά
            <select
              className="field mt-1 w-full"
              value={offerId}
              onChange={(e) => setOfferId(e.target.value)}
              required
            >
              {offers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.badge ? `${o.badge} · ` : ""}
                  {o.title}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-3">
            <label className="text-sm font-semibold">
              Μέρα
              <input
                type="date"
                className="field mt-1 block"
                value={date}
                min={athensToday()}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>
            <label className="text-sm font-semibold">
              Ώρα
              <input
                type="time"
                className="field mt-1 block"
                value={time}
                step={300}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["Αύριο 08:00", tomorrow(), "08:00"],
                ["Αύριο 12:00", tomorrow(), "12:00"],
                ["Σήμερα 19:00", athensToday(), "19:00"],
              ] as const
            ).map(([label, d, t]) => (
              <button
                key={label}
                type="button"
                className={clsx(
                  "rounded-full border-2 px-3 py-1 text-sm font-semibold",
                  date === d && time === t ? "border-rust bg-rust text-onrust" : "border-line",
                )}
                onClick={() => {
                  setDate(d);
                  setTime(t);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="block text-sm font-semibold">
            Δικό σου κείμενο <span className="font-normal text-char/55">(προαιρετικό, αλλιώς της προσφοράς)</span>
            <input
              className="field mt-1 w-full"
              maxLength={200}
              value={body}
              placeholder="π.χ. Τελευταία μέρα σήμερα! Παράγγειλε από τις 12:00"
              onChange={(e) => setBody(e.target.value)}
            />
          </label>
          <p className="text-xs text-char/55">Ώρα Ελλάδας.</p>
          <button type="submit" className="btn-primary" disabled={busy || !doc}>
            Προγραμματισμός
          </button>
        </form>
      )}

      <h2 className="mt-8 font-display text-lg font-semibold">Σε αναμονή ({pending.length})</h2>
      {doc && pending.length === 0 && <p className="mt-2 text-sm text-char/55">Καμία προγραμματισμένη.</p>}
      <ul className="mt-3 space-y-2">
        {pending.map((it) => (
          <li key={it.id} className="card flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">⏰ {when(it.sendAt)}</p>
              <p className="text-sm text-char/70">
                {it.offerTitle}
                {it.body && <span className="text-char/55"> · «{it.body}»</span>}
              </p>
            </div>
            <button type="button" className="btn-secondary text-sm text-rust" onClick={() => void cancel(it)}>
              Ακύρωση
            </button>
          </li>
        ))}
      </ul>

      {done.length > 0 && (
        <>
          <h2 className="mt-8 font-display text-lg font-semibold">Ιστορικό</h2>
          <ul className="mt-3 space-y-2">
            {done.map((it) => (
              <li key={it.id} className="card p-3 text-sm opacity-80">
                <p className="font-semibold">
                  {STATUS[it.status as Exclude<Status, "pending">]} · {when(it.sendAt)}
                </p>
                <p className="text-char/70">
                  {it.offerTitle}
                  {it.status === "sent" && ` · σε ${it.sent ?? 0} ${it.sent === 1 ? "συσκευή" : "συσκευές"}`}
                  {it.note && ` · ${it.note}`}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
