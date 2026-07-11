type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

export function checkRateLimit(key: string, maxAttempts: number, windowMs: number) {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1, retryAfterMs: 0 };
  }

  if (entry.count >= maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(0, entry.resetAt - now),
    };
  }

  entry.count += 1;
  store.set(key, entry);

  return {
    allowed: true,
    remaining: Math.max(0, maxAttempts - entry.count),
    retryAfterMs: 0,
  };
}

export function resetRateLimit(key: string) {
  store.delete(key);
}
