import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Records that the signed-in user just opened a document, so the dashboard can sort
// "recently opened" first. No-ops quietly if the doc isn't theirs or storage is off.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return Response.json({ ok: false });

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === 'string' ? body.name : '';
  if (!name.startsWith(`${userId}__`)) return Response.json({ ok: false });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await supabase.from('documents').update({ last_opened_at: new Date().toISOString() }).eq('name', name).eq('owner_id', userId);
  return Response.json({ ok: true });
}
