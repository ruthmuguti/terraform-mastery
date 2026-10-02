// Fixed-window in-memory rate limiter, per Lambda instance (best-effort, no cross-instance sync).

const WINDOW_MS = 60_000;
const LIMIT = 30;
const SWEEP_THRESHOLD = 10_000;

const hits = new Map<string, { start: number; count: number }>();

/**
 * Returns { ok: true } if the request is within the rate limit for the given userId,
 * or { ok: false; retryAfter } (seconds until the window resets) if the limit is exceeded.
 *
 * @param userId  - The authenticated user's ID.
 * @param now     - Current timestamp in ms; defaults to Date.now() so tests can inject a clock.
 */
export function rateLimit(
  userId: string,
  now: number = Date.now(),
): { ok: true } | { ok: false; retryAfter: number } {
  // Sweep expired entries when the map grows too large.
  if (hits.size >= SWEEP_THRESHOLD) {
    for (const [key, entry] of hits) {
      if (now - entry.start >= WINDOW_MS) {
        hits.delete(key);
      }
    }
  }

  const entry = hits.get(userId);

  if (!entry || now - entry.start >= WINDOW_MS) {
    // No entry or the previous window has expired — start a fresh window.
    hits.set(userId, { start: now, count: 1 });
    return { ok: true };
  }

  if (entry.count < LIMIT) {
    entry.count += 1;
    return { ok: true };
  }

  // Over the limit — compute how many seconds until the window resets.
  const retryAfter = Math.max(1, Math.ceil((entry.start + WINDOW_MS - now) / 1000));
  return { ok: false, retryAfter };
}
