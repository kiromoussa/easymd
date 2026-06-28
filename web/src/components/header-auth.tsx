'use client';

import Link from 'next/link';
import { SignInButton, SignUpButton, UserButton, useAuth } from '@clerk/nextjs';

export function HeaderAuth({ isLight }: { isLight: boolean }) {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return <div className="h-9 w-24 animate-pulse rounded-full bg-slate-200" />;
  }

  if (isSignedIn) {
    return (
      <>
        <Link
          href="/dashboard"
          className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-fg)] shadow-sm transition hover:bg-[var(--accent-hover)]"
        >
          Dashboard
        </Link>
        <UserButton />
      </>
    );
  }

  return (
    <>
      <SignInButton mode="modal">
        <button
          className={`hidden rounded-full px-4 py-2 text-sm font-medium sm:inline-flex ${
            isLight ? 'text-[var(--accent-strong)] hover:bg-[var(--accent)]/10' : 'text-white hover:bg-white/10'
          }`}
        >
          Sign in
        </button>
      </SignInButton>
      <SignUpButton mode="modal">
        <button className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-fg)] shadow-sm transition hover:bg-[var(--accent-hover)]">
          Sign up free
        </button>
      </SignUpButton>
    </>
  );
}
