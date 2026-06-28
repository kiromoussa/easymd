import { dark } from '@clerk/themes';

// `baseTheme: dark` alone is unreliable under Turbopack, so the dark look is driven by
// EXPLICIT color variables (which Clerk applies to the whole card incl. footer).
const fontFamily = 'var(--font-inter), ui-sans-serif, system-ui, sans-serif';

// The lime primary button needs dark text/icon. The `dark` baseTheme forces the
// button foreground to white, so override it explicitly at the element level.
const primaryButton = {
  color: '#1a1e05',
  '& *': { color: '#1a1e05' },
  '& svg': { color: '#1a1e05', stroke: '#1a1e05' },
  '&:hover': { color: '#1a1e05' },
};

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
  elements: {
    formButtonPrimary: primaryButton,
  },
};

export const clerkLight = {
  variables: {
    colorPrimary: '#daff76',
    colorTextOnPrimaryBackground: '#1a1e05',
    borderRadius: '0.6rem',
    fontFamily,
  },
  elements: {
    formButtonPrimary: primaryButton,
  },
};
