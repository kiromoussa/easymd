import { Suspense } from 'react';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { CliAuthClient } from '@/components/cli-auth-client';

export const dynamic = 'force-dynamic';

export default async function CliAuthPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa] px-6 dark:bg-[#0b0e13]">
      <Suspense fallback={null}>
        <CliAuthClient />
      </Suspense>
    </div>
  );
}
