'use client';

import { useState } from 'react';

export function CopyCommand({ command, note }: { command: string; note?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="flex items-center gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--ink-soft)] px-4 py-3 font-mono text-sm">
        <span className="select-none text-[var(--accent)]">$</span>
        <code className="flex-1 truncate text-[var(--mint)]">{command}</code>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy command"
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--hairline)] px-2.5 py-1 text-xs font-medium text-[var(--mint-muted)] transition hover:bg-white/5 hover:text-[var(--mint)]"
        >
          {copied ? (
            <>
              <svg className="h-3.5 w-3.5 text-[var(--accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      {note && <p className="mt-2 text-xs text-[var(--mint-faint)]">{note}</p>}
    </div>
  );
}
