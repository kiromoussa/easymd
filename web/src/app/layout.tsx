import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { Inter } from 'next/font/google';
import './globals.css';

// Match easymd's dark + lime palette on all Clerk UI (modals, sign-in/up pages).
const clerkAppearance = {
  baseTheme: dark,
  variables: {
    colorPrimary: '#daff76',
    colorTextOnPrimaryBackground: '#333804',
    colorBackground: '#0b0f0e',
    colorInputBackground: '#11151b',
    colorText: '#e8ffef',
    colorTextSecondary: 'rgba(232,255,239,0.72)',
    colorInputText: '#e8ffef',
    borderRadius: '0.6rem',
    fontFamily: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif',
  },
};

const inter = Inter({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'easymd',
  description:
    'Collaborate on CLAUDE.md and AGENTS.md in real time. Clean markdown saves 40–90% tokens vs HTML, DOCX, and PDF. The file on disk stays canonical.',
};

const themeScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={clerkAppearance}>
      <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        </head>
        <body className="min-h-full font-sans antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
