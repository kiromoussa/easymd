// Lightweight fixed-window rate limiter.
//
// NOTE: this is in-memory, so it bounds abuse per server instance. On a single host
// (the collab box, local dev) that's real protection. On horizontally-scaled
// serverless it's best-effort per instance — swap the Map for Vercel KV / Upstash
// (same interface) when you deploy at scale.
type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset <= now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (b.count >= limit) return { ok: false, retryAfter: Math.ceil((b.reset - now) / 1000) };
  b.count++;
  return { ok: true, retryAfter: 0 };
}

// Best-effort client identifier for keying limits.
export function clientKey(req: Request): string {
  const h = req.headers;
  return (h.get('x-forwarded-for')?.split(',')[0].trim() || h.get('x-real-ip') || 'local').slice(0, 64);
}

// Returns a 429 Response if over the limit, else null. Opportunistically prunes.
export function limited(scope: string, id: string, limit: number, windowMs: number): Response | null {
  if (buckets.size > 5000) {
    const now = Date.now();
    for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
  }
  const { ok, retryAfter } = rateLimit(`${scope}:${id}`, limit, windowMs);
  if (ok) return null;
  return Response.json({ error: 'rate limited, slow down' }, { status: 429, headers: { 'Retry-After': String(retryAfter) } });
}
