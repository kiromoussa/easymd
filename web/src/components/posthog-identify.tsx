'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect } from 'react';
import posthog from 'posthog-js';

// Ties PostHog person profiles to the signed-in Clerk user, and resets on sign-out so
// a shared machine doesn't merge two people's activity. Renders nothing.
export function PostHogIdentify() {
  const { isLoaded, isSignedIn, user } = useUser();

  useEffect(() => {
    if (!isLoaded || !posthog.__loaded) return;

    if (isSignedIn && user) {
      posthog.identify(user.id, {
        email: user.primaryEmailAddress?.emailAddress,
        name: user.fullName ?? undefined,
      });
    } else if (!isSignedIn) {
      posthog.reset();
    }
  }, [isLoaded, isSignedIn, user]);

  return null;
}
