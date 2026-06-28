import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { EditorShell } from '@/components/editor-shell';
import { ensureRoom, readRoomText, replaceRoomText, setRoomAccess, WELCOME_MD } from '@/lib/liveblocks-server';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// A doc opens if you own it (room prefix), it's shared with you (ACL), or it has
// "anyone with the link" access.
async function canOpen(room: string, userId: string) {
  if (room.startsWith(`${userId}__`)) return true;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return false;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await supabase.from('document_acl').select('user_id').eq('doc_name', room).eq('user_id', userId).maybeSingle();
  if (data) return true;
  const { data: doc } = await supabase.from('documents').select('link_access').eq('name', room).maybeSingle();
  return !!doc && doc.link_access !== 'none';
}

export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const { doc } = await searchParams;
  const requested = doc && (await canOpen(doc, userId)) ? doc : undefined;
  // Default to this account's welcome doc; ensure the Liveblocks room exists (and seed
  // the welcome content on first creation) before the client connects.
  const target = requested ?? `${userId}__welcome`;
  if (target.startsWith(`${userId}__`)) {
    await ensureRoom(target, userId);
    // Seed the welcome copy ONLY into a genuinely empty room. Keying off "was the room
    // just created" is fragile and was re-seeding (and wiping edits) on every open.
    if (target.endsWith('__welcome')) {
      const existing = await readRoomText(target);
      if (!existing.trim()) await replaceRoomText(target, WELCOME_MD);
    }
  } else if (requested) {
    // Shared doc opened by a non-owner who's permitted (ACL) — make sure they actually
    // have Liveblocks room access, so the connection doesn't drop to "Offline".
    await setRoomAccess(target, userId, true).catch(() => {});
  }

  return (
    <div className="h-screen">
      <EditorShell initialDoc={target} />
    </div>
  );
}
