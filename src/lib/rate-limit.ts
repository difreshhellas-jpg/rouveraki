/**
 * In-memory fixed-window limiter. Good enough for a single-instance deployment
 * and for blunting order spam from one IP or phone number.
 *
 * TODO:SCALE — on a multi-instance deploy this must move to Upstash/Redis or a
 * Postgres counter, because each instance keeps its own map and the effective
 * limit multiplies by the instance count.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Opportunistic sweep so the map cannot grow without bound.
const sweep = () => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export const rateLimit = (
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult => {
  if (buckets.size > 5000) sweep();
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const ok = existing.count <= limit;
  return {
    ok,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: ok ? 0 : Math.ceil((existing.resetAt - now) / 1000),
  };
};

/**
 * Best-effort client IP behind Vercel/Cloudflare-style proxies.
 *
 * SECURITY: x-forwarded-for is attacker-controlled unless the edge in front of
 * this app overwrites it. Vercel and Cloudflare both do. If this is ever moved
 * behind a plain Nginx/Caddy, that proxy MUST be configured to replace the
 * header rather than append to it — otherwise a client can mint a fresh bucket
 * per request and the order rate limit stops limiting anything.
 * The per-phone limit in the order route is the backstop for exactly that case.
 */
export const clientIp = (req: Request): string => {
  const h = req.headers;
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("cf-connecting-ip") ?? h.get("x-real-ip") ?? "unknown";
};
