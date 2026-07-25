// In-memory sliding-window rate limiter. Suitable for a single-node deployment
// (which matches the SQLite setup). For multi-node, back this with Redis — the
// interface stays the same. Mitigates audit C3 (brute force + AI cost abuse).

type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

// Opportunistic cleanup so the map can't grow unbounded.
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of store) if (b.resetAt <= now) store.delete(k);
}

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSec: number };

/** Returns ok=false when the key has exceeded `limit` requests in `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const b = store.get(key);
  if (!b || b.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count++;
  return { ok: true, remaining: limit - b.count, retryAfterSec: 0 };
}

/** Best-effort client IP from proxy headers. */
export function clientIp(req: Request): string {
  const h = req.headers;
  return (
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

// Common presets.
export const LIMITS = {
  auth: { limit: 10, windowMs: 60_000 }, // 10 login/signup attempts per IP/min
  ai: { limit: 20, windowMs: 60_000 }, // 20 AI calls per user/min
  write: { limit: 60, windowMs: 60_000 }, // general mutations
} as const;
