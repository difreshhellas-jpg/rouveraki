import "server-only";
import webpush from "web-push";
import { createHash, randomBytes } from "node:crypto";
import { kvDel, kvGet, kvHDel, kvHGetAll, kvHLen, kvHSet, kvSet } from "@/lib/kv";
import type { Offer } from "@/lib/offer-types";

/**
 * The owner's offers (edited from /demo-kitchen/offers) and the customers who
 * asked to be notified about them (Web Push).
 *
 * Push needs a VAPID key pair in the Vercel project settings:
 * VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (create with
 * `npx web-push generate-vapid-keys`). Without them offers still show on the
 * site; only the phone notifications are switched off.
 */
const OFFERS_KEY = "offers:doc";
const SUBS_KEY = "offers:push-subs";

export async function loadOffers(): Promise<Offer[]> {
  return (await kvGet<{ offers: Offer[] }>(OFFERS_KEY))?.offers ?? [];
}

export async function saveOffers(offers: Offer[]): Promise<void> {
  await kvSet(OFFERS_KEY, { offers, savedAt: new Date().toISOString() });
  await pruneOfferImages(offers).catch(() => {});
}

/* ---- the owner's own banner photos ----------------------------------------
 * Kept in the same store (no separate file storage needed). The shop app
 * shrinks each photo to about 200-400 KB before it is sent.
 */
const IMG_INDEX = "offers:images";
const imgKey = (id: string) => `offer-img:${id}`;
export const OFFER_IMAGE_PATH = "/api/offers/image/";
type StoredImage = { type: string; b64: string };

/** Saves one photo and returns the URL the offer uses. */
export async function saveOfferImage(type: string, bytes: Buffer): Promise<string> {
  const id = randomBytes(12).toString("hex");
  await kvSet(imgKey(id), { type, b64: bytes.toString("base64") } satisfies StoredImage);
  await kvHSet(IMG_INDEX, id, Date.now());
  return OFFER_IMAGE_PATH + id;
}

export async function loadOfferImage(id: string): Promise<{ type: string; bytes: Buffer } | null> {
  if (!/^[a-f0-9]{24}$/.test(id)) return null;
  const img = await kvGet<StoredImage>(imgKey(id));
  return img ? { type: img.type, bytes: Buffer.from(img.b64, "base64") } : null;
}

/** Deletes uploaded photos no offer uses any more (giving a fresh upload a day to be saved). */
async function pruneOfferImages(offers: Offer[]): Promise<void> {
  const used = new Set(
    offers.flatMap((o) => (o.image?.startsWith(OFFER_IMAGE_PATH) ? [o.image.slice(OFFER_IMAGE_PATH.length)] : [])),
  );
  const dayAgo = Date.now() - 86_400_000;
  for (const [id, at] of await kvHGetAll<number>(IMG_INDEX)) {
    if (used.has(id) || at > dayAgo) continue;
    await kvDel(imgKey(id));
    await kvHDel(IMG_INDEX, id);
  }
}

/* ---- push ---------------------------------------------------------------- */
export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY?.trim() || null;
const vapidPrivateKey = () => process.env.VAPID_PRIVATE_KEY?.trim() || null;
export const pushConfigured = () => Boolean(vapidPublicKey() && vapidPrivateKey());

export type PushSub = { endpoint: string; keys: { p256dh: string; auth: string } };

const subId = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex").slice(0, 32);

export async function addSubscriber(sub: PushSub): Promise<void> {
  await kvHSet(SUBS_KEY, subId(sub.endpoint), sub);
}

export async function removeSubscriber(endpoint: string): Promise<void> {
  await kvHDel(SUBS_KEY, subId(endpoint));
}

export const subscriberCount = () => kvHLen(SUBS_KEY);

/** Sends one notification to every subscriber; drops subscriptions that are gone. */
export async function sendToSubscribers(payload: {
  title: string;
  body: string;
  url: string;
  tag: string;
}): Promise<{ sent: number; failed: number; removed: number }> {
  const pub = vapidPublicKey();
  const priv = vapidPrivateKey();
  if (!pub || !priv) throw new Error("push_not_configured");
  webpush.setVapidDetails(process.env.VAPID_SUBJECT?.trim() || "https://rouveraki.com", pub, priv);

  const subs = await kvHGetAll<PushSub>(SUBS_KEY);
  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  let removed = 0;
  // Batches of 50 so a long list does not open hundreds of connections at once.
  for (let i = 0; i < subs.length; i += 50) {
    const batch = subs.slice(i, i + 50);
    const results = await Promise.allSettled(
      batch.map(([, s]) => webpush.sendNotification(s, body, { TTL: 24 * 3600, urgency: "normal" })),
    );
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === "fulfilled") {
        sent++;
        continue;
      }
      const code = (r.reason as { statusCode?: number } | undefined)?.statusCode;
      // 404/410: the customer turned notifications off or the browser dropped it.
      if (code === 404 || code === 410) {
        removed++;
        await kvHDel(SUBS_KEY, batch[j][0]).catch(() => {});
      } else failed++;
    }
  }
  return { sent, failed, removed };
}
