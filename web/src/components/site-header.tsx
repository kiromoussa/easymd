import Link from 'next/link';
import { HeaderAuth } from '@/components/header-auth';
import { ThemeToggle } from '@/components/theme-toggle';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-white/10 dark:bg-slate-950/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1a73e8] text-sm font-bold text-white">
            e
          </span>
          <span className="text-lg font-medium tracking-tight text-slate-900 dark:text-white">easymd</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm md:flex">
          <Link href="/#tokens" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
            Token savings
          </Link>
          <Link href="/#why-markdown" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
            Why markdown
          </Link>
          <Link href="/#collaborate" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
            Collaborate
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <HeaderAuth isLight />
        </div>
      </div>
    </header>
  );
}
