import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { DemoEditor } from '@/components/demo-editor';

export default async function DemoPage() {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  return (
    <div className="h-screen">
      <DemoEditor />
    </div>
  );
}
