import crypto from 'crypto';
import WS from 'ws';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { createClient } from '@supabase/supabase-js';
import { verifyCliToken, bearerFrom, isTokenActive } from '@/lib/cli-token';
import { limited } from '@/lib/rate-limit';

export const runtime = 'nodejs';

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

const WS_URL = process.env.COLLAB_WS_URL || process.env.NEXT_PUBLIC_COLLAB_WS_URL || 'ws://127.0.0.1:3848';
const COLLAB_SECRET = process.env.COLLAB_SECRET || '';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const slug = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Self-mint a short-lived collab ticket (the server holds COLLAB_SECRET).
function mintTicket(room: string) {
  if (!COLLAB_SECRET) return '';
  const exp = Date.now() + 60_000;
  const sig = crypto.createHmac('sha256', COLLAB_SECRET).update(`${room}.${exp}`).digest('hex');
  return `${exp}.${sig}`;
}

function supa() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Open the live collab room and run `fn(ytext)` against it; optionally flush a mutation.
async function withRoom<T>(room: string, mutate: boolean, fn: (t: Y.Text, d: Y.Doc) => T): Promise<T> {
  const ydoc = new Y.Doc();
  const ticket = mintTicket(room);
  const provider = new WebsocketProvider(WS_URL, room, ydoc, {
    WebSocketPolyfill: WS as unknown as typeof WebSocket,
    params: ticket ? { ticket } : {},
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`Timed out connecting to collab server at ${WS_URL}`)), 10000);
      provider.on('sync', (synced: boolean) => synced && (clearTimeout(t), resolve()));
    });
    await sleep(400); // let persisted state load
    const result = fn(ydoc.getText('markdown'), ydoc);
    if (mutate) await sleep(900); // let the server's debounced Supabase save flush
    return result;
  } finally {
    provider.destroy();
    ydoc.destroy();
  }
}

const writeRoom = (room: string, content: string) =>
  withRoom(room, true, (ytext, ydoc) => {
    ydoc.transact(() => {
      ytext.delete(0, ytext.length);
      ytext.insert(0, content);
    });
  });

const readRoom = (room: string) => withRoom(room, false, (ytext) => ytext.toString());

const appendRoom = (room: string, text: string) =>
  withRoom(room, true, (ytext, ydoc) => {
    ydoc.transact(() => {
      const prefix = ytext.length && !ytext.toString().endsWith('\n') ? '\n' : '';
      ytext.insert(ytext.length, prefix + text);
    });
    return ytext.length;
  });

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
      return Response.json({ name: room, content: await readRoom(room) });
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
    if (body?.op === 'append') {
      const text = typeof body?.text === 'string' ? body.text : '';
      const total = await appendRoom(room, text);
      return Response.json({ name: room, bytes: total });
    }

    const content = typeof body?.content === 'string' ? body.content : '';
    await writeRoom(room, content);
    const title = typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : rawName.trim();
    // Record owner_id + friendly title (collab sets owner_id from the room name on save).
    const supabase = supa();
    if (supabase) await supabase.from('documents').update({ owner_id: userId, title }).eq('name', room);
    return Response.json({ name: room, title, bytes: content.length });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
