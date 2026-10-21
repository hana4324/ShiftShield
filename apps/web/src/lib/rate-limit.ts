import "server-only";

/**
 * Best-effort in-memory sliding-window rate limiter.
 *
 * On Vercel each serverless instance keeps its own map, so this is a first line of defense
 * (together with the honeypot and timing check), not a hard guarantee. Swap `check` for an
 * Upstash/Vercel KV implementation when abuse becomes a problem; the call site stays the same.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const store: Map<string, Bucket> =
  (globalThis as { __ssRateLimit?: Map<string, Bucket> }).__ssRateLimit ??
  new Map<string, Bucket>();
(globalThis as { __ssRateLimit?: Map<string, Bucket> }).__ssRateLimit = store;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function checkRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  // Opportunistic cleanup so the map does not grow unbounded on long-lived instances.
  if (store.size > 5_000) {
    for (const [k, b] of store) if (b.resetAt <= now) store.delete(k);
  }
  const bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  if (bucket.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count, retryAfterSec: 0 };
}
