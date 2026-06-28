import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import { DashboardGrid, type DashboardDoc } from '@/components/dashboard-grid';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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
