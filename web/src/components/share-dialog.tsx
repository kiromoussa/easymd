'use client';

import { useCallback, useEffect, useState } from 'react';

type Collaborator = { userId: string; email: string; role: 'editor' | 'viewer' };

// Google-Docs-style sharing (inspired by suitenumerique/docs): invite by email with a
// role, see everyone who has access, change roles, and remove people.
export function ShareDialog({
  docName,
  docTitle,
  ownerEmail,
  onClose,
}: {
  docName: string;
  docTitle: string;
  ownerEmail: string;
  onClose: () => void;
}) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents/share?name=${encodeURIComponent(docName)}`);
      const j = await res.json().catch(() => ({}));
      setCollaborators(Array.isArray(j.collaborators) ? j.collaborators : []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [docName]);

  useEffect(() => {
    load();
  }, [load]);

  const invite = useCallback(async () => {
    const addr = email.trim();
    if (!addr) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/documents/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: docName, email: addr, role }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || 'Could not share');
        return;
      }
      setEmail('');
      await load();
    } finally {
      setBusy(false);
    }
  }, [email, role, docName, load]);

  const changeRole = useCallback(
    async (addr: string, newRole: 'editor' | 'viewer') => {
      setBusy(true);
      await fetch('/api/documents/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: docName, email: addr, role: newRole }),
      }).catch(() => {});
      await load();
      setBusy(false);
    },
    [docName, load],
  );

  const remove = useCallback(
    async (userId: string) => {
      setBusy(true);
      await fetch(`/api/documents/share?name=${encodeURIComponent(docName)}&user=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      }).catch(() => {});
      await load();
      setBusy(false);
    },
    [docName, load],
  );

  const initial = (s: string) => (s.trim()[0] || '?').toUpperCase();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#151a21]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
          <h2 className="truncate text-base font-semibold text-slate-900 dark:text-white">Share “{docTitle}”</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-slate-400 hover:bg-black/5 dark:hover:bg-white/10">
            ✕
          </button>
        </div>

        {/* Invite row */}
        <div className="px-5 pt-4">
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && invite()}
              placeholder="Add people by email"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[var(--accent-strong)] focus:outline-none dark:border-white/15 dark:bg-[#0b0e13] dark:text-white"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
              className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700 focus:outline-none dark:border-white/15 dark:bg-[#0b0e13] dark:text-slate-200"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              onClick={invite}
              disabled={busy || !email.trim()}
              className="shrink-0 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-[var(--accent-fg)] transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              Invite
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>

        {/* People with access */}
        <div className="px-5 py-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">People with access</p>
          <ul className="max-h-72 space-y-1 overflow-auto thin-scroll">
            {/* Owner */}
            <li className="flex items-center gap-3 rounded-lg px-2 py-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-[var(--accent-fg)]">
                {initial(ownerEmail)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-900 dark:text-white">{ownerEmail || 'You'}</span>
              <span className="text-xs text-slate-400">Owner</span>
            </li>

            {loading && <li className="px-2 py-2 text-sm text-slate-400">Loading…</li>}
            {!loading && collaborators.length === 0 && (
              <li className="px-2 py-2 text-sm text-slate-400">Only you have access. Invite someone above.</li>
            )}

            {collaborators.map((c) => (
              <li key={c.userId} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-black/5 dark:hover:bg-white/5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700 dark:bg-white/10 dark:text-slate-200">
                  {initial(c.email)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-900 dark:text-white">{c.email}</span>
                <select
                  value={c.role}
                  disabled={busy}
                  onChange={(e) => changeRole(c.email, e.target.value as 'editor' | 'viewer')}
                  className="rounded-md border border-slate-200 bg-transparent px-1.5 py-1 text-xs text-slate-600 focus:outline-none dark:border-white/15 dark:text-slate-300"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  onClick={() => remove(c.userId)}
                  disabled={busy}
                  title="Remove access"
                  className="rounded-md px-1.5 py-1 text-xs text-slate-400 hover:bg-black/5 hover:text-red-600 dark:hover:bg-white/10"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
