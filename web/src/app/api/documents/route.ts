import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { ensureRoom, replaceRoomText } from '@/lib/liveblocks-server';

export const runtime = 'nodejs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function client() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

// Documents are namespaced per account: the room id / primary key is
// "<owner_id>__<slug>". "__" never appears in a slug, so the prefix is unambiguous.
const roomName = (ownerId: string, name: string) => `${ownerId}__${slug(name)}`;

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = client();
  if (!supabase) return Response.json({ documents: [], configured: false });

  const { data, error } = await supabase
    .from('documents')
    .select('name, title, updated_at')
    .eq('owner_id', userId)
    .order('updated_at', { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ documents: data ?? [], configured: true });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = client();
  if (!supabase) return Response.json({ error: 'Supabase not configured' }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const rawName = typeof body?.name === 'string' ? body.name : '';
  if (!slug(rawName)) return Response.json({ error: 'A valid document name is required' }, { status: 400 });

  const name = roomName(userId, rawName);

  const { data: existing } = await supabase.from('documents').select('name').eq('name', name).maybeSingle();
  if (existing) return Response.json({ error: 'A document with that name already exists' }, { status: 409 });

  const title = typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : rawName.trim() || slug(rawName);
  const initial =
    typeof body?.content === 'string' && body.content.length
      ? body.content
      : `# ${title}\n\nStart writing — humans and AI agents edit this document together.\n`;

  // Content lives in the Liveblocks room; Supabase keeps metadata only.
  await ensureRoom(name, userId);
  await replaceRoomText(name, initial);

  const { error } = await supabase
    .from('documents')
    .insert({ name, owner_id: userId, title, state: '', updated_at: new Date().toISOString() });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ name, title }, { status: 201 });
}

// Rename: change a document's display title (the room id / slug identity is unchanged).
export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = client();
  if (!supabase) return Response.json({ error: 'Supabase not configured' }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === 'string' ? body.name : '';
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  if (!name.startsWith(`${userId}__`)) return Response.json({ error: 'forbidden' }, { status: 403 });
  if (!title) return Response.json({ error: 'A title is required' }, { status: 400 });

  const { error } = await supabase
    .from('documents')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('name', name)
    .eq('owner_id', userId);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ name, title });
}

export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = client();
  if (!supabase) return Response.json({ error: 'Supabase not configured' }, { status: 503 });

  const name = new URL(req.url).searchParams.get('name') || '';
  if (!name.startsWith(`${userId}__`)) return Response.json({ error: 'forbidden' }, { status: 403 });

  const { error } = await supabase.from('documents').delete().eq('name', name).eq('owner_id', userId);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ ok: true });
}
