import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Long-lived bearer token issued to the easymd CLI at `easymd login`. Format:
//   easymd_<base64url(JSON{uid,jti,exp})>.<hex hmac>
// The HMAC (over the payload segment) is keyed with CLI_TOKEN_SECRET, so the token is
// self-verifying. The `jti` lets us revoke individual tokens (see cli_tokens table)
// without rotating the secret. Falls back to COLLAB_SECRET if no CLI secret is set.
const SECRET = process.env.CLI_TOKEN_SECRET || process.env.COLLAB_SECRET || '';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const PREFIX = 'easymd_';
const TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

const b64url = (buf: Buffer) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

function supa() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function isConfigured() {
  return Boolean(SECRET);
}

export function mintCliToken(userId: string): { token: string; jti: string } {
  const jti = crypto.randomUUID();
  const payload = b64url(Buffer.from(JSON.stringify({ uid: userId, jti, exp: Date.now() + TTL_MS })));
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return { token: `${PREFIX}${payload}.${sig}`, jti };
}

// HMAC + expiry check. Returns {userId, jti} or null. Does NOT hit the DB (sync).
export function verifyCliToken(token: string | null | undefined): { userId: string; jti: string } | null {
  if (!SECRET || !token || !token.startsWith(PREFIX)) return null;
  const body = token.slice(PREFIX.length);
  const dot = body.indexOf('.');
  if (dot === -1) return null;
  const payload = body.slice(0, dot);
  const sig = body.slice(dot + 1);
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const { uid, jti, exp } = JSON.parse(unb64url(payload).toString('utf8'));
    if (!uid || typeof exp !== 'number' || exp < Date.now()) return null;
    return { userId: uid, jti: jti || '' };
  } catch {
    return null;
  }
}

export function bearerFrom(req: Request): string | null {
  const h = req.headers.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
}

// Record a freshly minted token so it can later be revoked.
export async function registerToken(jti: string, ownerId: string, label = 'cli') {
  const s = supa();
  if (!s || !jti) return;
  await s.from('cli_tokens').insert({ jti, owner_id: ownerId, label });
}

// True if the token's jti is still active (present and not revoked). If the registry
// isn't reachable, fail OPEN for tokens issued before the registry existed (jti present
// but no row) is treated as active; an explicit revoked=true row blocks access.
export async function isTokenActive(jti: string): Promise<boolean> {
  const s = supa();
  if (!s || !jti) return true; // no registry → HMAC alone gates (back-compat)
  const { data, error } = await s.from('cli_tokens').select('revoked').eq('jti', jti).maybeSingle();
  if (error) return true; // don't lock users out on a transient DB error
  if (!data) return true; // legacy token minted before the registry
  return data.revoked === false;
}

// Mark a token (by jti, scoped to owner) revoked.
export async function revokeToken(jti: string, ownerId: string) {
  const s = supa();
  if (!s || !jti) return;
  await s.from('cli_tokens').update({ revoked: true }).eq('jti', jti).eq('owner_id', ownerId);
}
