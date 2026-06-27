'use client';

import Link from 'next/link';
import { SignUpButton } from '@clerk/nextjs';

export function HeroCtas() {
  return (
    <div className="mt-10 flex flex-wrap items-center gap-4">
      <SignUpButton mode="modal">
        <button className="rounded-full bg-[#1a73e8] px-6 py-3 text-sm font-medium text-white shadow-md transition hover:bg-[#1765cc]">
          Sign up free — try the demo
        </button>
      </SignUpButton>
      <Link
        href="/sign-in"
        className="rounded-full border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Sign in
      </Link>
    </div>
  );
}

export function FooterCtas() {
  return (
    <div className="mt-10 flex flex-wrap justify-center gap-4">
      <SignUpButton mode="modal">
        <button className="rounded-full bg-white px-6 py-3 text-sm font-medium text-[#1a73e8] shadow-md transition hover:bg-blue-50">
          Create free account
        </button>
      </SignUpButton>
      <Link
        href="/demo"
        className="rounded-full border border-white/40 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10"
      >
        Go to demo →
      </Link>
    </div>
  );
}
