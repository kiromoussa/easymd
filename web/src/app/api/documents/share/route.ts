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

// GET ?name=room → collaborators (with emails), pending invites, and link access.
export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const supabase = supa();
  if (!supabase) return Response.json({ collaborators: [], pendingInvites: [], linkAccess: 'none' });

  const room = new URL(req.url).searchParams.get('name') || '';
  if (!ownsRoom(room, userId)) return Response.json({ error: 'forbidden' }, { status: 403 });

  const [{ data: aclRows }, { data: invRows }, { data: doc }] = await Promise.all([
    supabase.from('document_acl').select('user_id, role').eq('doc_name', room),
    supabase.from('document_invites').select('email, role').eq('doc_name', room),
    supabase.from('documents').select('link_access').eq('name', room).maybeSingle(),
  ]);

  let collaborators = (aclRows ?? []).map((r) => ({ userId: r.user_id, role: r.role, email: r.user_id }));
  try {
    const client = await clerkClient();
    collaborators = await Promise.all(
      (aclRows ?? []).map(async (r) => {
        const u = await client.users.getUser(r.user_id).catch(() => null);
        return { userId: r.user_id, role: r.role, email: u?.primaryEmailAddress?.emailAddress || r.user_id };
      }),
    );
  } catch {
    /* keep ids as labels */
  }

  return Response.json({
    collaborators,
    pendingInvites: (invRows ?? []).map((r) => ({ email: r.email, role: r.role })),
    linkAccess: doc?.link_access ?? 'none',
  });
}

// POST { name, email, role }       → invite by email (existing user → ACL; else → pending)
// POST { name, linkAccess }        → set "anyone with the link" access ('none'|'view'|'edit')
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const supabase = supa();
  if (!supabase) return Response.json({ error: 'Supabase not configured' }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const room = typeof body?.name === 'string' ? body.name : '';
  if (!ownsRoom(room, userId)) return Response.json({ error: 'forbidden' }, { status: 403 });

  // Link-access update.
  if (typeof body?.linkAccess === 'string') {
    const link = ['none', 'view', 'edit'].includes(body.linkAccess) ? body.linkAccess : 'none';
    const { error } = await supabase.from('documents').update({ link_access: link }).eq('name', room).eq('owner_id', userId);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true, linkAccess: link });
  }

  // Invite by email.
  const email = (typeof body?.email === 'string' ? body.email : '').trim().toLowerCase();
  const role = body?.role === 'viewer' ? 'viewer' : 'editor';
  if (!email) return Response.json({ error: 'An email is required' }, { status: 400 });

  let grantee: string | null = null;
  try {
    const client = await clerkClient();
    const res = await client.users.getUserList({ emailAddress: [email] });
    grantee = res.data[0]?.id ?? null;
  } catch {
    /* fall through to pending invite */
  }
  if (grantee === userId) return Response.json({ error: 'You already own this document' }, { status: 400 });

  if (grantee) {
    const { error } = await supabase
      .from('document_acl')
      .upsert({ doc_name: room, user_id: grantee, role, invited_by: userId }, { onConflict: 'doc_name,user_id' });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    try {
      await setRoomAccess(room, grantee, role !== 'viewer');
    } catch {
      /* room may not exist yet */
    }
    return Response.json({ ok: true, email, role, pending: false });
  }

  // No account yet → record a pending invite, claimed when they sign up.
  const { error } = await supabase
    .from('document_invites')
    .upsert({ doc_name: room, email, role, invited_by: userId }, { onConflict: 'doc_name,email' });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, email, role, pending: true });
}

// DELETE ?name=room&user=clerkId  → revoke a collaborator
// DELETE ?name=room&email=addr    → cancel a pending invite
export async function DELETE(req: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const supabase = supa();
  if (!supabase) return Response.json({ error: 'Supabase not configured' }, { status: 503 });

  const url = new URL(req.url);
  const room = url.searchParams.get('name') || '';
  const target = url.searchParams.get('user') || '';
  const email = (url.searchParams.get('email') || '').trim().toLowerCase();
  if (!ownsRoom(room, userId)) return Response.json({ error: 'forbidden' }, { status: 403 });

  if (email) {
    const { error } = await supabase.from('document_invites').delete().eq('doc_name', room).eq('email', email);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true });
  }

  const { error } = await supabase.from('document_acl').delete().eq('doc_name', room).eq('user_id', target);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  try {
    await setRoomAccess(room, target, false);
  } catch {
    /* ignore */
  }
  return Response.json({ ok: true });
}
