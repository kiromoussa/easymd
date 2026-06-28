import { auth } from '@clerk/nextjs/server';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { limited } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const COLLAB_SECRET = process.env.COLLAB_SECRET || '';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const TTL_MS = 8 * 60 * 60 * 1000; // 8 hours — long enough to survive reconnects.

// A user may access a room if they own it (room prefix) or have an ACL grant.
async function hasAccess(room: string, userId: string) {
  if (room.startsWith(`${userId}__`)) return true;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return false;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await supabase.from('document_acl').select('user_id').eq('doc_name', room).eq('user_id', userId).maybeSingle();
  return !!data;
}

// A ticket authorizes access to one collab room until `exp`. Signature binds the room
// + expiry so a ticket can't be replayed against a different room. The route only
// issues tickets for rooms the signed-in user owns ("<userId>__<slug>").
function sign(room: string, exp: number) {
  return crypto.createHmac('sha256', COLLAB_SECRET).update(`${room}.${exp}`).digest('hex');
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const rl = limited('collab-ticket', userId, 240, 60_000);
  if (rl) return rl;

  if (!COLLAB_SECRET) {
    return Response.json({ error: 'COLLAB_SECRET is not configured on the server' }, { status: 503 });
  }

  const room = new URL(req.url).searchParams.get('doc') || '';
  if (!room) return Response.json({ error: 'doc is required' }, { status: 400 });

  // The owner, or anyone the doc is shared with, may obtain a ticket.
  if (!(await hasAccess(room, userId))) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  const exp = Date.now() + TTL_MS;
  const ticket = `${exp}.${sign(room, exp)}`;
  return Response.json({ ticket });
}
