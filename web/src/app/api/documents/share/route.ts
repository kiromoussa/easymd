import { auth, clerkClient } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';
import { setRoomAccess } from '@/lib/liveblocks-server';

export const runtime = 'nodejs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function supa() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Only the document's owner can manage sharing. Ownership is encoded in the room name.
const ownsRoom = (room: string, userId: string) => room.startsWith(`${userId}__`);

// GET ?name=room  → list collaborators (with emails) for a doc you own
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const supabase = supa();
  if (!supabase) return Response.json({ collaborators: [] });

  const room = new URL(req.url).searchParams.get('name') || '';
  if (!ownsRoom(room, userId)) return Response.json({ error: 'forbidden' }, { status: 403 });

  const { data } = await supabase.from('document_acl').select('user_id, role').eq('doc_name', room);
  const rows = data ?? [];
  // Resolve user ids → emails for display (best effort).
  let collaborators = rows.map((r) => ({ userId: r.user_id, role: r.role, email: r.user_id }));
  try {
    const client = await clerkClient();
    collaborators = await Promise.all(
      rows.map(async (r) => {
        const u = await client.users.getUser(r.user_id).catch(() => null);
        return { userId: r.user_id, role: r.role, email: u?.primaryEmailAddress?.emailAddress || r.user_id };
      }),
    );
  } catch {
    /* keep ids as labels */
  }
  return Response.json({ collaborators });
}

// POST { name, email, role? } → grant a user (by email) access to a doc you own
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const supabase = supa();
  if (!supabase) return Response.json({ error: 'Supabase not configured' }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const room = typeof body?.name === 'string' ? body.name : '';
  const email = (typeof body?.email === 'string' ? body.email : '').trim().toLowerCase();
  const role = body?.role === 'viewer' ? 'viewer' : 'editor';
  if (!ownsRoom(room, userId)) return Response.json({ error: 'forbidden' }, { status: 403 });
  if (!email) return Response.json({ error: 'An email is required' }, { status: 400 });

  // Resolve the email to a Clerk user.
  let grantee: string | null = null;
  try {
    const client = await clerkClient();
    const res = await client.users.getUserList({ emailAddress: [email] });
    grantee = res.data[0]?.id ?? null;
  } catch {
    return Response.json({ error: 'Could not look up that user' }, { status: 502 });
  }
  if (!grantee) return Response.json({ error: 'No easymd account with that email. They need to sign up first.' }, { status: 404 });
  if (grantee === userId) return Response.json({ error: 'You already own this document' }, { status: 400 });

  const { error } = await supabase
    .from('document_acl')
    .upsert({ doc_name: room, user_id: grantee, role, invited_by: userId }, { onConflict: 'doc_name,user_id' });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Grant the collaborator access to the Liveblocks room.
  try {
    await setRoomAccess(room, grantee, role !== 'viewer');
  } catch {
    /* room may not exist yet; access still recorded in ACL */
  }

  return Response.json({ ok: true, email, role });
}

// DELETE ?name=room&user=clerkUserId → revoke a collaborator
export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const supabase = supa();
  if (!supabase) return Response.json({ error: 'Supabase not configured' }, { status: 503 });

  const url = new URL(req.url);
  const room = url.searchParams.get('name') || '';
  const target = url.searchParams.get('user') || '';
  if (!ownsRoom(room, userId)) return Response.json({ error: 'forbidden' }, { status: 403 });

  const { error } = await supabase.from('document_acl').delete().eq('doc_name', room).eq('user_id', target);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  try {
    await setRoomAccess(room, target, false);
  } catch {
    /* ignore */
  }
  return Response.json({ ok: true });
}
