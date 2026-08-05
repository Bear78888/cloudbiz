import "server-only";

/**
 * A small in-memory rate limiter for unauthenticated routes.
 *
 * Deliberately not backed by the database. The endpoint this protects can be
 * hit by anyone with a URL, and a limiter that writes a row per request would
 * hand an attacker a way to fill the database by doing exactly the thing the
 * limiter exists to stop. Counting in memory costs nothing and cannot be
 * amplified.
 *
 * What this is honestly not: a cluster-wide limit. Each serverless instance
 * keeps its own counters, so a spread-out attacker gets one budget per warm
 * instance. That is a real limit on what this buys — it stops a hammering
 * script and shapes ordinary abuse; it is not a defence against a distributed
 * one. The thing actually protecting the estimate link is that the token is
 * 256 random bits, which is not guessable at any request rate. This exists so
 * that trying still costs something and shows up in the logs.
 *
 * A shared limiter (Upstash/Redis) is the upgrade when there is a second
 * endpoint that needs one; today there is one, and adding a network dependency
 * to serve it would be the more fragile choice.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Bounded so a stream of distinct keys cannot grow the map without limit. */
const MAX_KEYS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    // Evict expired entries before growing; if the map is still at capacity the
    // request is allowed rather than refused, because failing closed here would
    // let a flood of junk keys deny service to real visitors.
    if (buckets.size >= MAX_KEYS) {
      for (const [existingKey, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(existingKey);
      }
      if (buckets.size >= MAX_KEYS) {
        return { allowed: true, remaining: 0, resetAt: now + windowMs };
      }
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  existing.count += 1;
  return {
    allowed: existing.count <= limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}

/**
 * The client's address, as far as it can be known behind a proxy.
 *
 * `x-forwarded-for` is caller-controlled in general; on Vercel the platform
 * sets it and the leftmost entry is the real client. Used only as a rate-limit
 * key, never as an identity or an authorization input — a spoofed value costs
 * its owner their own bucket and nothing else.
 */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? "unknown";
}

/** Test seam: the counters are process-global, so tests must be able to reset. */
export function resetRateLimits(): void {
  buckets.clear();
}
