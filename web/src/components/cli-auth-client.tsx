'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import { Logo } from '@/components/logo';

type Phase = 'idle' | 'authorizing' | 'sent' | 'error';

export function CliAuthClient() {
  const params = useSearchParams();
  const port = params.get('port') || '';
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');

  const authorize = useCallback(async () => {
    setPhase('authorizing');
    setError('');
    try {
      const res = await fetch('/api/cli/token', { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Could not mint a CLI token');
      // Hand the token back to the CLI's local callback server.
      if (port) {
        window.location.href = `http://127.0.0.1:${port}/callback?token=${encodeURIComponent(j.token)}`;
        setPhase('sent');
      } else {
        // No local port (manual mode) — show the token to paste.
        setError('');
        setPhase('sent');
        (window as unknown as { __token?: string }).__token = j.token;
        setManualToken(j.token);
      }
    } catch (e) {
      setError((e as Error).message);
      setPhase('error');
    }
  }, [port]);

  const [manualToken, setManualToken] = useState('');

  // Auto-start once the user is known and a port is present.
  useEffect(() => {
    if (isLoaded && isSignedIn && port && phase === 'idle') authorize();
  }, [isLoaded, isSignedIn, port, phase, authorize]);

  if (!isLoaded) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>;
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-[#151a21]">
      <Logo className="mx-auto mb-4 h-12 w-12 text-slate-900 dark:text-white" />
      <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Authorize the easymd CLI</h1>

      {user && (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Signed in as {user.primaryEmailAddress?.emailAddress || user.username}
        </p>
      )}

      {phase === 'sent' && port && (
        <p className="mt-6 rounded-lg bg-[var(--accent)]/12 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200">
          ✓ CLI authorized. You can return to your terminal — this tab will hand the token back automatically.
        </p>
      )}

      {phase === 'sent' && !port && manualToken && (
        <div className="mt-6 text-left">
          <p className="text-sm text-slate-500 dark:text-slate-400">Paste this into your terminal:</p>
          <code className="mt-2 block w-full break-all rounded-lg bg-slate-100 p-3 text-xs text-slate-800 dark:bg-white/10 dark:text-slate-200">
            {manualToken}
          </code>
        </div>
      )}

      {phase === 'error' && (
        <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      {(phase === 'idle' || phase === 'error') && (
        <button
          type="button"
          onClick={authorize}
          className="mt-6 w-full rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent-fg)] transition hover:bg-[var(--accent-hover)]"
        >
          Authorize CLI
        </button>
      )}

      <p className="mt-4 text-xs text-slate-400">
        This grants the CLI on this machine permission to create and update markdown documents in your account.
      </p>
    </div>
  );
}
