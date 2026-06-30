'use client';

import { useState } from 'react';
import * as Y from 'yjs';
import { useHistoryVersions, useHistoryVersionData } from '@liveblocks/react';
import { capture } from '@/lib/analytics';

// Renders the markdown stored in a specific Liveblocks version snapshot.
function VersionPreview({ versionId, onRestore }: { versionId: string; onRestore: (text: string) => void }) {
  const { isLoading, data } = useHistoryVersionData(versionId);

  if (isLoading || !data) {
    return <div className="p-6 text-sm text-[#80868b]">Loading version…</div>;
  }
  const doc = new Y.Doc();
  Y.applyUpdate(doc, data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer));
  const text = doc.getText('codemirror').toString();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end border-b border-[#e3e6ea] px-4 py-2 dark:border-[#262d38]">
        <button
          type="button"
          onClick={() => {
            capture('version_restored');
            onRestore(text);
          }}
          className="rounded-md bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-[var(--accent-fg)] transition hover:bg-[var(--accent-hover)]"
        >
          Restore this version
        </button>
      </div>
      <pre className="thin-scroll flex-1 overflow-auto whitespace-pre-wrap p-4 text-sm leading-relaxed text-[#202124] dark:text-[#e6e8eb]">
        {text || '(empty)'}
      </pre>
    </div>
  );
}

export function VersionHistory({ onRestore }: { onRestore: (text: string) => void }) {
  const { versions, isLoading } = useHistoryVersions();
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="flex h-full w-full max-w-5xl gap-4">
      {/* Version list */}
      <aside className="w-64 shrink-0 overflow-auto thin-scroll rounded-xl border border-[#e3e6ea] bg-white dark:border-[#262d38] dark:bg-[#161b22]">
        <div className="border-b border-[#e3e6ea] px-4 py-3 dark:border-[#262d38]">
          <p className="text-sm font-semibold text-[#202124] dark:text-[#e6e8eb]">Version history</p>
          <p className="mt-0.5 text-xs text-[#80868b]">Snapshots are captured automatically as the doc changes.</p>
        </div>
        {isLoading && <p className="px-4 py-3 text-xs text-[#80868b]">Loading…</p>}
        {!isLoading && (!versions || versions.length === 0) && (
          <p className="px-4 py-3 text-xs text-[#80868b]">No versions yet. Edit the document and check back — Liveblocks captures versions over time.</p>
        )}
        <ul className="py-1">
          {(versions ?? []).map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => setSelected(v.id)}
                className={`flex w-full flex-col items-start px-4 py-2 text-left text-sm transition hover:bg-black/5 dark:hover:bg-white/10 ${
                  selected === v.id ? 'bg-[var(--accent)]/10 font-medium text-[var(--accent-strong)]' : 'text-[#5f6368] dark:text-[#9aa3af]'
                }`}
              >
                <span>{v.createdAt.toLocaleString()}</span>
                <span className="text-[10px] text-[#80868b]">{v.authors?.length ? `${v.authors.length} editor(s)` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Preview */}
      <section className="min-w-0 flex-1 overflow-hidden rounded-xl border border-[#e3e6ea] bg-white dark:border-[#262d38] dark:bg-[#161b22]">
        {selected ? (
          <VersionPreview versionId={selected} onRestore={onRestore} />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-center text-sm text-[#80868b]">
            Select a version on the left to preview it, then restore if you want to roll back.
          </div>
        )}
      </section>
    </div>
  );
}
