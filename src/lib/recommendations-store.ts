import "server-only";
import { kvGet, kvSet } from "@/lib/kv";
import bundled from "@/data/recommendations.json";
import type { Recommendation } from "@/lib/offer-types";

/**
 * Checkout recommendations. Until the owner saves his own list from
 * /demo-kitchen/offers, the defaults in src/data/recommendations.json are
 * used. Whether a saved list exists decides it (not its length), so an owner
 * who removes every recommendation does not get the defaults back.
 */
const KEY = "recs:doc";

export const DEFAULT_RECOMMENDATIONS = bundled.recommendations as Recommendation[];

export async function loadRecommendations(): Promise<{ recs: Recommendation[]; saved: boolean }> {
  try {
    const doc = await kvGet<{ recs: Recommendation[] }>(KEY);
    if (doc) return { recs: doc.recs, saved: true };
  } catch {
    /* store unreachable: the defaults keep checkout working */
  }
  return { recs: DEFAULT_RECOMMENDATIONS, saved: false };
}

export async function saveRecommendations(recs: Recommendation[]): Promise<void> {
  await kvSet(KEY, { recs, savedAt: new Date().toISOString() });
}
