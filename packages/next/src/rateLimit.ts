const PRUNE_INTERVAL_MS = 30_000;
const MAX_ENTRIES = 5_000;

/**
 * Creates an in-memory sliding window rate limiter.
 * Prunes expired entries every 30 seconds or when the map exceeds 5,000 entries,
 * preventing unbounded memory growth from distributed traffic.
 */
export function createRateLimiter(maxRequests: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  let lastPrune = Date.now();

  return function isLimited(key: string): boolean {
    const now = Date.now();

    if (now - lastPrune > PRUNE_INTERVAL_MS || hits.size > MAX_ENTRIES) {
      for (const [k, timestamps] of hits) {
        if (timestamps.every((t) => now - t >= windowMs)) {
          hits.delete(k);
        }
      }
      lastPrune = now;
    }

    const existing = hits.get(key);
    const recent = existing ? existing.filter((t) => now - t < windowMs) : [];
    recent.push(now);
    hits.set(key, recent);

    return recent.length > maxRequests;
  };
}
