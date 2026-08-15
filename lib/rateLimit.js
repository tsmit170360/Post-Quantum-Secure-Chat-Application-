/**
 * Minimal in-memory fixed-window rate limiter.
 *
 * Deliberately dependency-free and process-local. That is sufficient for the
 * single-instance deployment this app targets; running multiple instances
 * would need a shared store (e.g. Redis) for the limit to be global.
 */

const buckets = new Map();
const SWEEP_THRESHOLD = 1000;

function sweepExpired(now) {
  if (buckets.size < SWEEP_THRESHOLD) return;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

/**
 * Consume one unit against `key`.
 * @returns {{allowed: boolean, retryAfter: number}} retryAfter is in seconds.
 */
export function consume(key, { limit, windowMs }) {
  const now = Date.now();
  sweepExpired(now);

  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfter: 0 };
}

/** Best-effort client address for use as a rate-limit key. */
export function clientKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

/**
 * Apply a limit and send a 429 when exceeded.
 * @returns {boolean} true when the caller may proceed.
 */
export function enforce(req, res, { scope, limit, windowMs }) {
  const { allowed, retryAfter } = consume(`${scope}:${clientKey(req)}`, { limit, windowMs });
  if (!allowed) {
    res.setHeader('Retry-After', String(retryAfter));
    res.status(429).json({ message: 'Too many attempts. Please try again later.' });
    return false;
  }
  return true;
}

/** Test hook: drop all state. */
export function resetAll() {
  buckets.clear();
}
