import "server-only";
import { randomBytes } from "node:crypto";
import { kvGet, kvSet, kvSetNX } from "@/lib/kv";
import { liveOffers } from "@/lib/offer-types";
import { loadOffers, pushConfigured, sendToSubscribers } from "@/lib/offers-store";

/**
 * Offer notifications the owner scheduled for later (e.g. tomorrow 08:00),
 * from the "Ειδοποιήσεις" tab of the shop app.
 *
 * Something has to call /api/notifications/run every few minutes to send the
 * ones that are due. The main trigger is an outside pinger (cron-job.org) with
 * CRON_SECRET; the shop app and site traffic also check, as a backup.
 */
const KEY = "notif:schedule";
const LAST_RUN = "notif:last-run";
export const MAX_PENDING = 30;
export const MAX_DAYS_AHEAD = 60;
/** A notification more than this late (pinger was down) is not sent any more. */
const LATE_LIMIT_MS = 3 * 3600_000;

export type ScheduledStatus = "pending" | "sent" | "skipped" | "missed" | "failed";
export type Scheduled = {
  id: string;
  offerId: string;
  /** Title of the offer when scheduled, for the list. */
  offerTitle: string;
  /** Optional own text instead of the offer's text. */
  body: string | null;
  /** UTC milliseconds. */
  sendAt: number;
  status: ScheduledStatus;
  doneAt?: number;
  sent?: number;
  note?: string;
};

export async function loadSchedule(): Promise<Scheduled[]> {
  return (await kvGet<Scheduled[]>(KEY)) ?? [];
}

async function saveSchedule(list: Scheduled[]): Promise<void> {
  // Keep every pending one and the latest 30 finished ones.
  const pending = list.filter((s) => s.status === "pending");
  const done = list
    .filter((s) => s.status !== "pending")
    .sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0))
    .slice(0, 30);
  await kvSet(KEY, [...pending, ...done]);
}

export async function lastRunAt(): Promise<number | null> {
  return kvGet<number>(LAST_RUN);
}

export async function addScheduled(s: Omit<Scheduled, "id" | "status">): Promise<Scheduled> {
  const list = await loadSchedule();
  if (list.filter((x) => x.status === "pending").length >= MAX_PENDING) throw new Error("too_many");
  const item: Scheduled = { ...s, id: randomBytes(6).toString("hex"), status: "pending" };
  await saveSchedule([...list, item]);
  return item;
}

export async function cancelScheduled(id: string): Promise<boolean> {
  const list = await loadSchedule();
  const next = list.filter((s) => !(s.id === id && s.status === "pending"));
  if (next.length === list.length) return false;
  await saveSchedule(next);
  return true;
}

/** Applies one change to one item, re-reading the list so nothing else is lost. */
async function update(id: string, patch: Partial<Scheduled>): Promise<void> {
  const list = await loadSchedule();
  await saveSchedule(list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
}

/** Sends every notification that is due. Safe to call often and from several places at once. */
export async function runDue(now = Date.now()): Promise<{ sent: number; checked: number }> {
  await kvSet(LAST_RUN, now);
  const due = (await loadSchedule()).filter((s) => s.status === "pending" && s.sendAt <= now);
  let sent = 0;
  for (const s of due) {
    // Only one caller may send a given notification.
    if (!(await kvSetNX(`notif:claim:${s.id}`, now, 24 * 3600))) continue;
    if (now - s.sendAt > LATE_LIMIT_MS) {
      await update(s.id, { status: "missed", doneAt: now, note: "Δεν στάλθηκε: η ώρα είχε περάσει πολύ." });
      continue;
    }
    const offer = liveOffers(await loadOffers(), new Date(now)).find((o) => o.id === s.offerId);
    if (!offer) {
      await update(s.id, { status: "skipped", doneAt: now, note: "Η προσφορά δεν είναι πια ενεργή." });
      continue;
    }
    if (!pushConfigured()) {
      await update(s.id, { status: "failed", doneAt: now, note: "Οι ειδοποιήσεις δεν έχουν ρυθμιστεί (VAPID)." });
      continue;
    }
    try {
      const r = await sendToSubscribers({
        title: offer.badge ? `${offer.badge} · ${offer.title}` : offer.title,
        body: s.body || offer.text || "Δες την προσφορά στο Ρουβεράκι",
        url: "/menu#offers",
        // Its own tag, so it rings again instead of quietly replacing the first one.
        tag: `offer-${offer.id}-${s.id}`,
      });
      sent += r.sent;
      await update(s.id, { status: "sent", doneAt: now, sent: r.sent });
    } catch {
      await update(s.id, { status: "failed", doneAt: now, note: "Η αποστολή απέτυχε." });
    }
  }
  return { sent, checked: due.length };
}

let lastLocalCheck = 0;
/** Cheap backup trigger from busy routes: at most once a minute per server instance. */
export async function maybeRunDue(): Promise<void> {
  const now = Date.now();
  if (now - lastLocalCheck < 60_000) return;
  lastLocalCheck = now;
  try {
    const list = await loadSchedule();
    if (list.some((s) => s.status === "pending" && s.sendAt <= now)) await runDue(now);
  } catch {
    /* the pinger will get it */
  }
}

/* ---- Greek time --------------------------------------------------------- */
const athensOffsetMs = (utcMs: number): number => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Athens",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(utcMs))
      .map((x) => [x.type, x.value]),
  );
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
};

/** "2026-11-22" + "08:00" in Greece → UTC milliseconds (summer and winter time). */
export function athensToUtc(date: string, time: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - athensOffsetMs(guess);
  return guess - athensOffsetMs(first);
}
