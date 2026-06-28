import { auth, currentUser } from '@clerk/nextjs/server';
import { Liveblocks } from '@liveblocks/node';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const liveblocks = new Liveblocks({ secret: process.env.LIVEBLOCKS_SECRET_KEY! });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const COLORS = ['#c6f24e', '#34a853', '#fbbc04', '#ea4335', '#9334e6', '#00acc1'];

// Is this user allowed to write to this room? Owners (room is "<userId>__<slug>") always
// can; everyone else needs an editor ACL grant. Returns 'write' | 'read' | null.
async function accessFor(room: string, userId: string): Promise<'write' | 'read' | null> {
  if (room.startsWith(`${userId}__`)) return 'write';
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await supabase
    .from('document_acl')
    .select('role')
    .eq('doc_name', room)
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return null;
  return data.role === 'viewer' ? 'read' : 'write';
}

// Access-token auth: authorization is computed here from our own source of truth
// (room ownership prefix + Supabase ACL), NOT from the room's stored usersAccesses.
// This guarantees a permitted user actually gets room:write, so edits persist instead
// of being silently dropped as read-only.
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const user = await currentUser();
  const name =
    user?.firstName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
    'You';
  const color = COLORS[(name.charCodeAt(0) || 0) % COLORS.length];

  const { room } = (await req.json().catch(() => ({}))) as { room?: string };

  const session = liveblocks.prepareSession(userId, {
    userInfo: { name, color, avatar: user?.imageUrl },
  });

  if (room) {
    const level = await accessFor(room, userId);
    if (level === 'write') session.allow(room, session.FULL_ACCESS);
    else if (level === 'read') session.allow(room, session.READ_ACCESS);
  } else {
    // No specific room requested — grant the user full access to their own namespace.
    session.allow(`${userId}__*`, session.FULL_ACCESS);
  }

  const { status, body } = await session.authorize();
  return new Response(body, { status });
}
