'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { useEffect, useState } from 'react';

// Lime accent + radius/font apply in both modes.
const base = {
  colorPrimary: '#daff76',
  colorTextOnPrimaryBackground: '#1a1e05',
  borderRadius: '0.6rem',
  fontFamily: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif',
};

// Makes Clerk follow the app's light/dark toggle: dark base theme when <html> has the
// `.dark` class, Clerk's light theme otherwise. Re-themes live when the toggle flips.
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

  const appearance = isDark ? { baseTheme: dark, variables: base } : { variables: base };

  // `key` forces Clerk to remount on theme flip — it doesn't always re-theme from a
  // live appearance prop change, so this guarantees the toggle actually takes effect.
  return (
    <ClerkProvider key={isDark ? 'dark' : 'light'} appearance={appearance}>
      {children}
    </ClerkProvider>
  );
}
