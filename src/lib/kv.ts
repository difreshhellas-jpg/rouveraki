import "server-only";

/**
 * Tiny key-value layer over Upstash Redis' REST API (the free store from the
 * Vercel Marketplace). Reads KV_REST_API_URL / KV_REST_API_TOKEN, or the
 * UPSTASH_REDIS_REST_* pair, whichever the integration injected.
 *
 * With neither set (local dev, or before the store is connected) it falls back
 * to a per-process Map so the site still runs. That fallback is NOT shared
 * between serverless instances, so it is only good for a single dev server.
 */
const URL_ = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

export const hasKv = () => Boolean(URL_ && TOKEN);

/** On Vercel the in-memory fallback would silently lose orders between instances. */
const assertStore = () => {
  if (!hasKv() && process.env.VERCEL) throw new Error("store_not_configured");
};

type Cmd = (string | number)[];

async function run<T>(cmd: Cmd): Promise<T> {
  const res = await fetch(URL_!, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`kv_${res.status}`);
  const body = (await res.json()) as { result: T; error?: string };
  if (body.error) throw new Error(`kv_${body.error}`);
  return body.result;
}

/* ---- in-memory fallback -------------------------------------------------- */
const mem = new Map<string, string>();
const memIdx = new Map<string, Map<string, number>>();

export async function kvGet<T>(key: string): Promise<T | null> {
  assertStore();
  const raw = hasKv() ? await run<string | null>(["GET", key]) : (mem.get(key) ?? null);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function kvSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  assertStore();
  const raw = JSON.stringify(value);
  if (!hasKv()) {
    mem.set(key, raw);
    return;
  }
  await run(ttlSeconds ? ["SET", key, raw, "EX", ttlSeconds] : ["SET", key, raw]);
}

export async function kvMGet<T>(keys: string[]): Promise<(T | null)[]> {
  assertStore();
  if (!keys.length) return [];
  const raws = hasKv()
    ? await run<(string | null)[]>(["MGET", ...keys])
    : keys.map((k) => mem.get(k) ?? null);
  return raws.map((r) => (r ? (JSON.parse(r) as T) : null));
}

/** Add a member to a sorted set (score = time) and keep it from growing forever. */
export async function kvIndexAdd(index: string, member: string, score: number): Promise<void> {
  assertStore();
  if (!hasKv()) {
    const m = memIdx.get(index) ?? new Map();
    m.set(member, score);
    memIdx.set(index, m);
    return;
  }
  await run(["ZADD", index, score, member]);
  await run(["ZREMRANGEBYSCORE", index, "-inf", score - 4 * 86_400_000]);
}

/** Members with a score at or above `since`, newest first. */
export async function kvIndexSince(index: string, since: number): Promise<string[]> {
  assertStore();
  if (!hasKv()) {
    return [...(memIdx.get(index) ?? [])]
      .filter(([, s]) => s >= since)
      .sort((a, b) => b[1] - a[1])
      .map(([m]) => m);
  }
  return run<string[]>(["ZREVRANGEBYSCORE", index, "+inf", since]);
}
