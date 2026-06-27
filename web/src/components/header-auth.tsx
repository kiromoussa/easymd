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
          href="/demo"
          className="rounded-full bg-[#1a73e8] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#1765cc]"
        >
          Open demo
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
            isLight ? 'text-[#1a73e8] hover:bg-blue-50' : 'text-white hover:bg-white/10'
          }`}
        >
          Sign in
        </button>
      </SignInButton>
      <SignUpButton mode="modal">
        <button className="rounded-full bg-[#1a73e8] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#1765cc]">
          Sign up free
        </button>
      </SignUpButton>
    </>
  );
}
