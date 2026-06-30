'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { ui } from '@clerk/ui';
import { useEffect, useState } from 'react';
import { clerkDark, clerkLight } from '@/lib/clerk-appearance';
import { PostHogIdentify } from '@/components/posthog-identify';

// Makes Clerk follow the app's light/dark toggle: explicit dark color variables when
// <html> has `.dark`, the light theme otherwise. Re-themes live on toggle.
export function ClerkAppearanceProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const el = document.documentElement;
    const update = () => setIsDark(el.classList.contains('dark'));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  return (
    <ClerkProvider key={isDark ? 'dark' : 'light'} ui={ui} appearance={isDark ? clerkDark : clerkLight}>
      <PostHogIdentify />
      {children}
    </ClerkProvider>
  );
}
