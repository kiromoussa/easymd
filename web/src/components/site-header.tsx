import Link from 'next/link';
import { HeaderAuth } from '@/components/header-auth';

export function SiteHeader({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const isLight = variant === 'light';

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-md ${
        isLight
          ? 'border-slate-200/80 bg-white/90'
          : 'border-white/10 bg-slate-950/80'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold ${
              isLight ? 'bg-[#1a73e8] text-white' : 'bg-white text-[#1a73e8]'
            }`}
          >
            e
          </span>
          <span
            className={`text-lg font-medium tracking-tight ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}
          >
            easymd
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm md:flex">
          <a
            href="/#tokens"
            className={isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}
          >
            Token savings
          </a>
          <a
            href="/#why-markdown"
            className={isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}
          >
            Why markdown
          </a>
          <a
            href="/#collaborate"
            className={isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'}
          >
            Collaborate
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <HeaderAuth isLight={isLight} />
        </div>
      </div>
    </header>
  );
}
