import { dark } from '@clerk/themes';

// `baseTheme: dark` alone is unreliable under Turbopack, so the dark look is driven by
// EXPLICIT color variables (which Clerk applies to the whole card incl. footer).
const fontFamily = 'var(--font-inter), ui-sans-serif, system-ui, sans-serif';

export const clerkDark = {
  baseTheme: dark,
  variables: {
    colorPrimary: '#daff76',
    colorTextOnPrimaryBackground: '#1a1e05',
    colorBackground: '#0b0f0e',
    colorInputBackground: '#11151b',
    colorInputText: '#e8ffef',
    colorText: '#e8ffef',
    colorTextSecondary: '#e8ffef',
    colorNeutral: '#e8ffef',
    borderRadius: '0.6rem',
    fontFamily,
  },
};

export const clerkLight = {
  variables: {
    colorPrimary: '#daff76',
    colorTextOnPrimaryBackground: '#1a1e05',
    borderRadius: '0.6rem',
    fontFamily,
  },
};
