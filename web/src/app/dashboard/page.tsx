import Link from 'next/link';
import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DashboardGrid, type DashboardDoc } from '@/components/dashboard-grid';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { setRoomAccess } from '@/lib/liveblocks-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Convert any pending email-invites for this user into real ACL grants, now that they
// have an account. Runs on dashboard load (cheap; usually finds nothing).
async function claimInvites(supabase: SupabaseClient, userId: string, email: string) {
  if (!email) return;
  const { data: invites } = await supabase.from('document_invites').select('doc_name, role').eq('email', email);
  if (!invites?.length) return;
  for (const inv of invites) {
    await supabase
      .from('document_acl')
      .upsert({ doc_name: inv.doc_name, user_id: userId, role: inv.role, invited_by: null }, { onConflict: 'doc_name,user_id' });
    await setRoomAccess(inv.doc_name, userId, inv.role !== 'viewer').catch(() => {});
  }
  await supabase.from('document_invites').delete().eq('email', email);
}

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  let docs: DashboardDoc[] = [];
  let configured = false;

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    configured = true;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Claim any pending invites addressed to this user's email.
    const me = await currentUser();
    await claimInvites(supabase, userId, me?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? '').catch(() => {});

    const { data } = await supabase
      .from('documents')
      .select('name, title, updated_at, last_opened_at')
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false });
    docs = ((data as DashboardDoc[]) ?? []).map((d) => ({ ...d, shared: false }));

    // Docs shared with this user (cross-account ACL grants).
    const { data: acl } = await supabase.from('document_acl').select('doc_name').eq('user_id', userId);
    const sharedNames = (acl ?? []).map((r) => r.doc_name);
    if (sharedNames.length) {
      const { data: sharedDocs } = await supabase
        .from('documents')
        .select('name, title, updated_at, last_opened_at')
        .in('name', sharedNames);
      docs = docs.concat(((sharedDocs as DashboardDoc[]) ?? []).map((d) => ({ ...d, shared: true })));
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] dark:bg-[#0b0e13]">
      {/* Minimal bar: home (→ landing) + profile only. */}
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-white/10 dark:bg-[#0b0e13]">
        <Link href="/" className="flex items-center gap-2" title="Home">
          <Logo className="h-8 w-8 text-slate-900 dark:text-white" />
          <span className="text-sm font-semibold text-slate-900 dark:text-white">easymd</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserButton />
        </div>
      </header>
      <DashboardGrid initialDocs={docs} configured={configured} ownerId={userId} />
    </div>
  );
}
