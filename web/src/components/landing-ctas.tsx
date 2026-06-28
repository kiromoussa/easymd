'use client';

import Link from 'next/link';
import { SignInButton, SignUpButton, UserButton, useAuth } from '@clerk/nextjs';
import { clerkDark } from '@/lib/clerk-appearance';

// The landing is always dark, so its auth modals are forced dark regardless of the
// user's theme (this per-button appearance only affects these flows). The marker class
// on the card lets CSS force the primary button's text black — landing modals only.
const landingClerk = {
  ...clerkDark,
  elements: { ...(clerkDark.elements ?? {}), card: 'easymd-landing-clerk' },
};

const primary =
  'rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-[var(--accent-fg)] transition hover:bg-[var(--accent-hover)]';

export function HeaderCtas() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return <div className="h-9 w-20 animate-pulse rounded-full bg-white/5" />;

  if (isSignedIn) {
    return (
      <div className="flex items-center gap-2.5">
        <Link href="/dashboard" className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] transition hover:bg-[var(--accent-hover)]">
          Dashboard
        </Link>
        <UserButton />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <SignInButton mode="modal" appearance={landingClerk} forceRedirectUrl="/dashboard" signUpForceRedirectUrl="/dashboard">
        <button className="px-3 py-2 text-sm text-[var(--mint-muted)] transition hover:text-[var(--mint)]">Sign in</button>
      </SignInButton>
      <SignUpButton mode="modal" appearance={landingClerk} forceRedirectUrl="/dashboard" signInForceRedirectUrl="/dashboard">
        <button className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] transition hover:bg-[var(--accent-hover)]">
          Get started
        </button>
      </SignUpButton>
    </div>
  );
}

export function HeroCtas() {
  const { isSignedIn } = useAuth();
  return (
    <div className="mt-10 flex flex-wrap items-center gap-3">
      {isSignedIn ? (
        <Link href="/dashboard" className={primary}>
          Open dashboard
        </Link>
      ) : (
        <SignUpButton mode="modal" appearance={landingClerk} forceRedirectUrl="/dashboard" signInForceRedirectUrl="/dashboard">
          <button className={primary}>Get started</button>
        </SignUpButton>
      )}
    </div>
  );
}

export function FooterCtas() {
  const { isSignedIn } = useAuth();
  // Sits on the lime CTA band, so the button is the dark inverse for contrast.
  const darkBtn = 'rounded-full bg-[var(--ink)] px-6 py-3 text-sm font-semibold text-[var(--mint)] transition hover:opacity-90';
  return (
    <div className="mt-10 flex flex-wrap justify-center gap-3">
      {isSignedIn ? (
        <Link href="/dashboard" className={darkBtn}>
          Open your dashboard →
        </Link>
      ) : (
        <SignUpButton mode="modal" appearance={landingClerk} forceRedirectUrl="/dashboard" signInForceRedirectUrl="/dashboard">
          <button className={darkBtn}>Get started free →</button>
        </SignUpButton>
      )}
    </div>
  );
}
