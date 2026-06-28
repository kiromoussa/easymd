import { createClient } from '@supabase/supabase-js';
import { verifyCliToken, bearerFrom } from '@/lib/cli-token';

export const runtime = 'nodejs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Bearer-authed: the CLI reads this before auto-syncing to decide whether to include
// CLAUDE.md / README.md / AGENTS.md. Defaults to false (exclude them).
export async function GET(req: Request) {
  const v = verifyCliToken(bearerFrom(req));
  if (!v) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return Response.json({ syncSpecial: false });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await supabase.from('user_settings').select('sync_special').eq('owner_id', v.userId).maybeSingle();
  return Response.json({ syncSpecial: data?.sync_special ?? false });
}
