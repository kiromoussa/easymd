'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export interface DashboardDoc {
  name: string; // room id: "<ownerId>__<slug>"
  title?: string | null;
  updated_at: string;
  last_opened_at?: string | null;
  shared?: boolean; // true if shared with you by another account
}

// Ordering key: most recently OPENED wins; never-opened docs fall back to when they
// were last added/updated.
const orderKey = (d: DashboardDoc) => d.last_opened_at || d.updated_at;

const prettify = (n: string) => n.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const stripOwner = (name: string) => {
  const i = name.indexOf('__');
  return i === -1 ? name : name.slice(i + 2);
};
const label = (d: DashboardDoc) => (d.title && d.title.trim() ? d.title : prettify(stripOwner(d.name)));

function relTime(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function DashboardGrid({
  initialDocs,
  configured,
  ownerId,
}: {
  initialDocs: DashboardDoc[];
  configured: boolean;
  ownerId: string;
}) {
  const router = useRouter();
  const [docs] = useState<DashboardDoc[]>(initialDocs);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const sorted = useMemo(
    () => [...docs].sort((a, b) => orderKey(b).localeCompare(orderKey(a))),
    [docs],
  );

  const createDoc = useCallback(async () => {
    const name = window.prompt('New document name (e.g. product-spec):');
    if (!name) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || 'Could not create document');
        return;
      }
      router.push(`/editor?doc=${encodeURIComponent(j.name)}`);
    } finally {
      setCreating(false);
    }
  }, [router]);

  const copyOwnerId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(ownerId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }, [ownerId]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Your documents
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Every markdown file in your account — edited live by you, your team, and your agents.
          </p>
        </div>
        <button
          type="button"
          onClick={createDoc}
          disabled={creating || !configured}
          className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-fg)] shadow-sm transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creating ? 'Creating…' : '＋ New document'}
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {/* MCP onboarding hint — your account id is what agents use to write into your account. */}
      <div className="mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-white/10 dark:bg-[#151a21]">
        <span className="text-slate-500 dark:text-slate-400">
          For AI agents (MCP), set{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-white/10">EASYMD_OWNER_ID</code> to your account id:
        </span>
        <code className="max-w-full truncate rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-white/10 dark:text-slate-200">
          {ownerId}
        </code>
        <button
          type="button"
          onClick={copyOwnerId}
          className="rounded-md border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {!configured ? (
        <div className="mt-10 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-white/15 dark:bg-[#151a21]">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Supabase isn’t configured</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
            Documents are kept in memory only and reset on restart. Add{' '}
            <code className="rounded bg-slate-100 px-1 dark:bg-white/10">SUPABASE_URL</code> and{' '}
            <code className="rounded bg-slate-100 px-1 dark:bg-white/10">SUPABASE_SERVICE_ROLE_KEY</code> to{' '}
            <code className="rounded bg-slate-100 px-1 dark:bg-white/10">web/.env.local</code> to save and list your files here.
          </p>
          <Link href="/editor" className="mt-5 inline-block text-sm font-medium text-[var(--accent-strong)] hover:underline">
            Open the live editor anyway →
          </Link>
        </div>
      ) : sorted.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-white/15 dark:bg-[#151a21]">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">No documents yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
            Create your first markdown document, or open the editor to start with your welcome doc.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={createDoc}
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-fg)] hover:bg-[var(--accent-hover)]"
            >
              ＋ New document
            </button>
            <Link href="/editor" className="text-sm font-medium text-[var(--accent-strong)] hover:underline">
              Open editor →
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* New document tile */}
          <button
            type="button"
            onClick={createDoc}
            disabled={creating}
            className="flex min-h-[160px] flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 transition hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)] disabled:opacity-50 dark:border-white/15 dark:text-slate-400"
          >
            <span className="text-3xl leading-none">＋</span>
            <span className="text-sm font-medium">New document</span>
          </button>

          {sorted.map((d) => (
            <Link
              key={d.name}
              href={`/editor?doc=${encodeURIComponent(d.name)}`}
              className="group flex min-h-[160px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:bg-[#151a21]"
            >
              <div className="flex flex-1 items-start gap-3 p-5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]/10 text-[var(--accent-strong)]">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 truncate font-medium text-slate-900 group-hover:text-[var(--accent-strong)] dark:text-white">
                    <span className="truncate">{label(d)}</span>
                    {d.shared && (
                      <span className="shrink-0 rounded-full bg-[var(--accent)]/20 px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent-strong)]">
                        Shared
                      </span>
                    )}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-slate-400">{stripOwner(d.name)}.md</p>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500 dark:border-white/5 dark:text-slate-400">
                <span>{d.last_opened_at ? `Opened ${relTime(d.last_opened_at)}` : `Added ${relTime(d.updated_at)}`}</span>
                <span className="font-medium text-[var(--accent-strong)] opacity-0 transition group-hover:opacity-100">Open →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
