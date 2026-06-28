import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import * as Y from 'yjs';

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

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const supabase = client();
  if (!supabase) return Response.json({ documents: [], configured: false });

  const { data, error } = await supabase
    .from('documents')
    .select('name, updated_at')
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
  const name = slug(rawName);
  if (!name) return Response.json({ error: 'A valid document name is required' }, { status: 400 });

  const { data: existing } = await supabase.from('documents').select('name').eq('name', name).maybeSingle();
  if (existing) return Response.json({ error: 'A document with that name already exists' }, { status: 409 });

  const title = typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : rawName.trim() || name;
  const initial = `# ${title}\n\nStart writing — humans and AI agents edit this document together.\n`;

  // Build the initial Yjs document state so it loads correctly when opened.
  const ydoc = new Y.Doc();
  ydoc.getText('markdown').insert(0, initial);
  const state = Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString('base64');

  const { error } = await supabase
    .from('documents')
    .insert({ name, state, updated_at: new Date().toISOString() });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ name, title }, { status: 201 });
}
