import { createClient } from '@supabase/supabase-js';
import { verifyCliToken, bearerFrom, isTokenActive } from '@/lib/cli-token';
import { limited } from '@/lib/rate-limit';
import { ensureRoom, readRoomText, replaceRoomText, appendRoomText } from '@/lib/liveblocks-server';

export const runtime = 'nodejs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const slug = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

function supa() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Verify the bearer token (HMAC + expiry) AND that it hasn't been revoked. Also applies
// a per-account rate limit. Returns the userId, or a Response to return immediately.
async function authCli(req: Request, limit: number): Promise<string | Response> {
  const v = verifyCliToken(bearerFrom(req));
  if (!v) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const rl = limited('cli-docs', v.userId, limit, 60_000);
  if (rl) return rl;
  if (!(await isTokenActive(v.jti))) return Response.json({ error: 'token revoked — run `easymd login` again' }, { status: 401 });
  return v.userId;
}

// GET            → list this account's documents
// GET ?name=foo  → return the markdown content of one document
export async function GET(req: Request) {
  const a = await authCli(req, 120);
  if (a instanceof Response) return a;
  const userId = a;

  const name = new URL(req.url).searchParams.get('name');
  if (name) {
    const room = `${userId}__${slug(name)}`;
    try {
      return Response.json({ name: room, content: await readRoomText(room) });
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 502 });
    }
  }

  const supabase = supa();
  if (!supabase) return Response.json({ documents: [] });
  const { data, error } = await supabase
    .from('documents')
    .select('name, title, updated_at')
    .eq('owner_id', userId)
    .order('updated_at', { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ documents: data ?? [] });
}

// POST {name, content}            → create or replace a document (full content)
// POST {name, op:'append', text}  → append markdown to the end
export async function POST(req: Request) {
  const a = await authCli(req, 120);
  if (a instanceof Response) return a;
  const userId = a;

  const body = await req.json().catch(() => ({}));
  const rawName = typeof body?.name === 'string' ? body.name : '';
  if (!slug(rawName)) return Response.json({ error: 'A valid document name is required' }, { status: 400 });
  const room = `${userId}__${slug(rawName)}`;

  try {
    await ensureRoom(room, userId);

    if (body?.op === 'append') {
      const text = typeof body?.text === 'string' ? body.text : '';
      const total = await appendRoomText(room, text);
      return Response.json({ name: room, bytes: total });
    }

    const content = typeof body?.content === 'string' ? body.content : '';
    await replaceRoomText(room, content);
    const title = typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : rawName.trim();
    // Upsert metadata so the doc shows in the dashboard (content lives in Liveblocks).
    const supabase = supa();
    if (supabase) {
      await supabase
        .from('documents')
        .upsert({ name: room, owner_id: userId, title, state: '', updated_at: new Date().toISOString() }, { onConflict: 'name' });
    }
    return Response.json({ name: room, title, bytes: content.length });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
