import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { DemoEditor } from '@/components/demo-editor';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// A doc opens if you own it (room prefix) or it's been shared with you (ACL).
async function canOpen(room: string, userId: string) {
  if (room.startsWith(`${userId}__`)) return true;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return false;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data } = await supabase.from('document_acl').select('user_id').eq('doc_name', room).eq('user_id', userId).maybeSingle();
  return !!data;
}

export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{ doc?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const { doc } = await searchParams;
  const initialDoc = doc && (await canOpen(doc, userId)) ? doc : undefined;

  return (
    <div className="h-screen">
      <DemoEditor initialDoc={initialDoc} />
    </div>
  );
}
