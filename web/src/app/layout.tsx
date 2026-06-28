import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { Roboto } from 'next/font/google';
import './globals.css';

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  variable: '--font-roboto',
});

export const metadata: Metadata = {
  title: 'easymd — Google Docs for Markdown',
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
    <ClerkProvider>
      <html lang="en" className={`${roboto.variable} h-full`} suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        </head>
        <body className="min-h-full font-sans antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}
