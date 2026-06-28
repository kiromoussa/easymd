import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function supa() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Dashboard (Clerk cookie) — read and update account preferences.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const supabase = supa();
  if (!supabase) return Response.json({ syncSpecial: false });
  const { data } = await supabase.from('user_settings').select('sync_special').eq('owner_id', userId).maybeSingle();
  return Response.json({ syncSpecial: data?.sync_special ?? false });
}

export async function PUT(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const supabase = supa();
  if (!supabase) return Response.json({ error: 'Supabase not configured' }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const syncSpecial = Boolean(body?.syncSpecial);
  const { error } = await supabase
    .from('user_settings')
    .upsert({ owner_id: userId, sync_special: syncSpecial, updated_at: new Date().toISOString() }, { onConflict: 'owner_id' });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ syncSpecial });
}
