import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ClerkAppearanceProvider } from '@/components/clerk-appearance-provider';
import './globals.css';

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
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full font-sans antialiased">
        <ClerkAppearanceProvider>{children}</ClerkAppearanceProvider>
      </body>
    </html>
  );
}
