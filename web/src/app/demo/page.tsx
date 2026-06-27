import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { SiteHeader } from '@/components/site-header';
import { DemoEditor } from '@/components/demo-editor';

export default async function DemoPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <div className="flex h-screen flex-col bg-white">
      <SiteHeader />
      <div className="border-b border-slate-200 bg-blue-50 px-6 py-3 text-sm text-slate-700">
        <span className="font-medium text-[#1a73e8]">You&apos;re in the live demo.</span>{' '}
        Open this page in another tab or share with a teammate to see real-time cursors.{' '}
        <Link href="/#tokens" className="text-[#1a73e8] underline-offset-2 hover:underline">
          See token savings →
        </Link>
      </div>
      <div className="min-h-0 flex-1">
        <DemoEditor />
      </div>
    </div>
  );
}
