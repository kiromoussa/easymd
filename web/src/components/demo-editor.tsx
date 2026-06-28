'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { EditorState, EditorSelection } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, undo, redo } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { yCollab } from 'y-codemirror.next';
import { marked } from 'marked';
import { useUser, UserButton } from '@clerk/nextjs';
import { ThemeToggle } from '@/components/theme-toggle';
import { Logo } from '@/components/logo';

const COLORS = ['#c6f24e', '#34a853', '#fbbc04', '#ea4335', '#9334e6', '#00acc1'];
const DEMO_BASE = 'welcome';
const WS_URL = process.env.NEXT_PUBLIC_COLLAB_WS_URL || 'ws://localhost:3848';

const prettify = (n: string) => n.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
// Room ids are namespaced "<owner_id>__<slug>"; show only the friendly part.
const stripOwner = (name: string) => {
  const i = name.indexOf('__');
  return i === -1 ? name : name.slice(i + 2);
};
const docLabel = (name: string, title?: string | null) =>
  title && title.trim() ? title : prettify(stripOwner(name));

/* Theme palette — explicit dark: variant utilities (robust under Turbopack). */
const PANEL = 'bg-white dark:bg-[#151a21]';
const CANVAS = 'bg-white dark:bg-[#161b22]';
const APP = 'bg-[#f1f3f4] dark:bg-[#0b0e13]';
const RAIL = 'bg-[#f8f9fa] dark:bg-[#11151b]';
const BORDER = 'border-[#e3e6ea] dark:border-[#262d38]';
const TEXT = 'text-[#202124] dark:text-[#e6e8eb]';
const MUTED = 'text-[#5f6368] dark:text-[#9aa3af]';
const MUTED2 = 'text-[#80868b] dark:text-[#6b7280]';
const HOVER = 'hover:bg-black/5 dark:hover:bg-white/10';
const ACCENT = 'text-[var(--accent-strong)] dark:text-[var(--accent-strong)]';
const ACCENT_SOFT = 'bg-[var(--accent)]/10 dark:bg-[var(--accent-strong)]/20';

type ViewMode = 'write' | 'split' | 'preview';
type Tab = 'editor' | 'history' | 'signatures' | 'previewMode';

interface Heading {
  level: number;
  text: string;
  line: number;
}

function Icon({ path, className = 'h-[18px] w-[18px]' }: { path: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}
const ICONS = {
  doc: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
  folder: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
  users: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 0 0M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.91 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 7.5 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.18 14H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 8.5l-.33-.6a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 10 4.18V4a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 2.91 1.17l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V10a2 2 0 0 1 0 4h-.09z',
  undo: 'M3 7v6h6M3 13a9 9 0 1 0 3-7.7L3 8',
  redo: 'M21 7v6h-6M21 13a9 9 0 1 1-3-7.7L21 8',
  bold: 'M6 4h8a4 4 0 0 1 0 8H6zM6 12h9a4 4 0 0 1 0 8H6z',
  italic: 'M19 4h-9M14 20H5M15 4L9 20',
  strike: 'M16 4H9a3 3 0 0 0-2.83 4M14 12a4 4 0 0 1 0 8H6M4 12h16',
  code: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  olist: 'M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M6 18H4l2-2.5a1 1 0 0 0-2-1.5',
  quote: 'M3 21c3 0 7-1 7-8V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M14 21c3 0 7-1 7-8V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2',
  link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  image: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zM8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21',
  hash: 'M4 9h16M4 15h16M10 3L8 21M16 3l-2 18',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  pen: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z',
  chevron: 'M6 9l6 6 6-6',
};

export function DemoEditor({ initialDoc }: { initialDoc?: string }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const { user } = useUser();

  const [tab, setTab] = useState<Tab>('editor');
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [previewHtml, setPreviewHtml] = useState('');
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [peerCount, setPeerCount] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeDoc, setActiveDoc] = useState(initialDoc ?? '');
  const [docs, setDocs] = useState<{ name: string; title?: string | null; updated_at: string }[]>([]);
  const [docMenuOpen, setDocMenuOpen] = useState(false);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [insertMenuOpen, setInsertMenuOpen] = useState(false);
  const [toast, setToast] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  // Latest handlers for CodeMirror keymap / paste / drop (avoids stale closures).
  const handlersRef = useRef<{ save: () => void; insertImageFiles: (f: FileList | File[]) => void }>({
    save: () => {},
    insertImageFiles: () => {},
  });

  const showToast = useCallback((m: string) => setToast(m), []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  // Once Clerk loads, default to this account's own demo doc ("<userId>__easymd-demo")
  // unless a specific document was requested (e.g. opened from the dashboard).
  useEffect(() => {
    if (!activeDoc && user?.id) setActiveDoc(`${user.id}__${DEMO_BASE}`);
  }, [user, activeDoc]);

  // Record "opened" so the dashboard can sort recently-opened docs first.
  useEffect(() => {
    if (!activeDoc) return;
    fetch('/api/documents/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: activeDoc }),
    }).catch(() => {});
  }, [activeDoc]);

  const loadDocs = useCallback(async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const j = await res.json();
        setDocs(Array.isArray(j.documents) ? j.documents : []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetch('/api/documents')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j) setDocs(Array.isArray(j.documents) ? j.documents : []);
      })
      .catch(() => {});
  }, []);

  const createDoc = useCallback(async () => {
    const name = window.prompt('New document name (e.g. product-spec):');
    if (!name) return;
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      window.alert(j.error || 'Could not create document');
      return;
    }
    await loadDocs();
    setActiveDoc(j.name);
    setDocMenuOpen(false);
  }, [loadDocs]);

  const refreshDerived = useCallback((text: string) => {
    setPreviewHtml(marked.parse(text, { async: false }) as string);
    const hs: Heading[] = [];
    text.split('\n').forEach((line, i) => {
      const m = /^(#{1,3})\s+(.*)$/.exec(line.trim());
      if (m) hs.push({ level: m[1].length, text: m[2].replace(/[#*`]/g, '').trim(), line: i });
    });
    setHeadings(hs);
  }, []);

  useEffect(() => {
    if (!editorRef.current || viewRef.current || !activeDoc) return;
    let cancelled = false;
    let cleanup = () => {};

    (async () => {
      // Obtain a short-lived access ticket for this room. The route is Clerk-protected
      // and only issues tickets for rooms this account owns.
      let ticket = '';
      try {
        const res = await fetch(`/api/collab-ticket?doc=${encodeURIComponent(activeDoc)}`);
        if (res.ok) ticket = (await res.json()).ticket || '';
      } catch {
        /* network error — connection will be rejected if the server requires auth */
      }
      if (cancelled || !editorRef.current || viewRef.current) return;

      const ydoc = new Y.Doc();
      const ytext = ydoc.getText('markdown');
      const provider = new WebsocketProvider(WS_URL, activeDoc, ydoc, {
        params: ticket ? { ticket } : {},
      });
      providerRef.current = provider;

      const displayName =
        user?.firstName || user?.username || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'You';
      const userColor = COLORS[(displayName.charCodeAt(0) || 0) % COLORS.length];

      provider.awareness.setLocalStateField('user', { name: displayName, color: userColor });
      provider.on('status', ({ status: s }: { status: string }) =>
        setStatus(s === 'connected' ? 'connected' : 'connecting'),
      );
      provider.on('connection-close', () => setStatus('disconnected'));

      const updatePeers = () => setPeerCount(provider.awareness.getStates().size);
      provider.awareness.on('change', updatePeers);
      updatePeers();

      const undoManager = new Y.UndoManager(ytext);

      const state = EditorState.create({
        doc: ytext.toString(),
        extensions: [
          lineNumbers(),
          drawSelection(),
          history(),
          markdown(),
          keymap.of([
            { key: 'Mod-s', preventDefault: true, run: () => { handlersRef.current.save(); return true; } },
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          yCollab(ytext, provider.awareness, { undoManager }),
          EditorView.lineWrapping,
          EditorView.domEventHandlers({
            paste: (e) => {
              const files = e.clipboardData?.files;
              if (files && files.length && Array.from(files).some((f) => f.type.startsWith('image/'))) {
                handlersRef.current.insertImageFiles(files);
                e.preventDefault();
                return true;
              }
              return false;
            },
            drop: (e) => {
              const files = e.dataTransfer?.files;
              if (files && files.length && Array.from(files).some((f) => f.type.startsWith('image/'))) {
                handlersRef.current.insertImageFiles(files);
                e.preventDefault();
                return true;
              }
              return false;
            },
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) refreshDerived(update.state.doc.toString());
          }),
          EditorView.theme({ '&': { height: '100%', backgroundColor: 'transparent' } }),
        ],
      });

      const view = new EditorView({ state, parent: editorRef.current });
      viewRef.current = view;
      refreshDerived(view.state.doc.toString());

      cleanup = () => {
        view.destroy();
        provider.destroy();
        ydoc.destroy();
        viewRef.current = null;
        providerRef.current = null;
      };
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [user, refreshDerived, activeDoc]);

  const wrapInline = useCallback((before: string, after = before) => {
    const view = viewRef.current;
    if (!view) return;
    const tr = view.state.changeByRange((range) => {
      const text = view.state.sliceDoc(range.from, range.to) || 'text';
      const insert = before + text + after;
      return {
        changes: { from: range.from, to: range.to, insert },
        range: EditorSelection.range(range.from + before.length, range.from + before.length + text.length),
      };
    });
    view.dispatch(tr);
    view.focus();
  }, []);

  const applyLinePrefix = useCallback((makePrefix: (lineText: string) => string) => {
    const view = viewRef.current;
    if (!view) return;
    const { state } = view;
    const lines = new Set<number>();
    state.selection.ranges.forEach((r) => {
      const lastLine = state.doc.lineAt(r.to).number;
      let ln = state.doc.lineAt(r.from).number;
      while (ln <= lastLine) {
        lines.add(ln);
        ln++;
      }
    });
    const changes = [...lines].map((n) => {
      const line = state.doc.line(n);
      return { from: line.from, to: line.to, insert: makePrefix(line.text) };
    });
    view.dispatch({ changes });
    view.focus();
  }, []);

  const setHeading = useCallback(
    (level: number) =>
      applyLinePrefix((t) => {
        const stripped = t.replace(/^#{1,6}\s+/, '');
        return level === 0 ? stripped : `${'#'.repeat(level)} ${stripped}`;
      }),
    [applyLinePrefix],
  );

  const insertLink = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    const tr = view.state.changeByRange((range) => {
      const text = view.state.sliceDoc(range.from, range.to) || 'link text';
      const insert = `[${text}](https://)`;
      return {
        changes: { from: range.from, to: range.to, insert },
        range: EditorSelection.range(range.from + text.length + 3, range.from + text.length + 11),
      };
    });
    view.dispatch(tr);
    view.focus();
  }, []);

  const goToHeading = useCallback((line: number) => {
    const view = viewRef.current;
    if (!view) return;
    const l = view.state.doc.line(Math.min(line + 1, view.state.doc.lines));
    view.dispatch({ selection: EditorSelection.cursor(l.from), scrollIntoView: true });
    view.focus();
  }, []);

  const statusMeta = useMemo(() => {
    if (status === 'connected') return { label: 'Synced', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' };
    if (status === 'connecting') return { label: 'Connecting…', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' };
    return { label: 'Offline', dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400' };
  }, [status]);

  const activeTitle = useMemo(() => {
    const d = docs.find((x) => x.name === activeDoc);
    return d ? docLabel(d.name, d.title) : activeDoc ? docLabel(activeDoc) : 'Loading…';
  }, [docs, activeDoc]);

  // ── Document actions (File / Insert menus, ⌘S, image, search) ─────────────────
  const getText = () => viewRef.current?.state.doc.toString() ?? '';
  const fileBase = (activeTitle || 'document').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'document';

  const triggerDownload = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportMarkdown = () => {
    triggerDownload(`${fileBase}.md`, getText(), 'text/markdown;charset=utf-8');
    showToast('Saved .md to your downloads');
  };
  const exportHtml = () => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${activeTitle}</title></head><body>${previewHtml}</body></html>`;
    triggerDownload(`${fileBase}.html`, html, 'text/html;charset=utf-8');
    showToast('Exported .html');
  };
  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(getText());
      showToast('Markdown copied');
    } catch {
      showToast('Copy failed');
    }
  };
  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('Share link copied');
    } catch {
      showToast('Copy failed');
    }
  };
  const printDoc = () => {
    const w = window.open('', '_blank');
    if (!w) {
      showToast('Pop-up blocked');
      return;
    }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${activeTitle}</title></head><body>${previewHtml}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
  };
  const renameDoc = async () => {
    const next = window.prompt('Rename document:', activeTitle);
    if (!next || next.trim() === activeTitle) return;
    const res = await fetch('/api/documents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: activeDoc, title: next.trim() }),
    });
    if (res.ok) {
      await loadDocs();
      showToast('Renamed');
    } else {
      showToast('Rename failed');
    }
  };
  const duplicateDoc = async () => {
    const base = stripOwner(activeDoc) || 'document';
    const name = window.prompt('Name for the copy:', `${base}-copy`);
    if (!name) return;
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, title: name, content: getText() }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(j.error || 'Duplicate failed');
      return;
    }
    await loadDocs();
    setActiveDoc(j.name);
    showToast('Duplicated');
  };
  const deleteDoc = async () => {
    if (!window.confirm(`Delete "${activeTitle}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/documents?name=${encodeURIComponent(activeDoc)}`, { method: 'DELETE' });
    if (!res.ok) {
      showToast('Delete failed');
      return;
    }
    const next = docs.find((d) => d.name !== activeDoc);
    await loadDocs();
    setActiveDoc(next?.name || (user?.id ? `${user.id}__${DEMO_BASE}` : ''));
    showToast('Deleted');
  };

  const shareDoc = async () => {
    if (!user?.id || !activeDoc.startsWith(`${user.id}__`)) {
      showToast('Only the owner can share this doc');
      return;
    }
    const email = window.prompt('Share with (email of an easymd account):');
    if (!email) return;
    const res = await fetch('/api/documents/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: activeDoc, email }),
    });
    const j = await res.json().catch(() => ({}));
    showToast(res.ok ? `Shared with ${j.email}` : j.error || 'Share failed');
  };

  const insertAtCursor = (text: string) => {
    const view = viewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    view.dispatch({ changes: { from, to, insert: text }, selection: EditorSelection.cursor(from + text.length) });
    view.focus();
  };

  const insertImageFiles = async (files: FileList | File[]) => {
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) return;
    showToast('Uploading image…');
    for (const file of imgs) {
      const alt = file.name.replace(/\.[^.]+$/, '');
      let url = '';
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        if (res.ok) url = (await res.json()).url || '';
      } catch {
        /* fall through to inline data URI */
      }
      if (!url) {
        url = await new Promise<string>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result || ''));
          r.onerror = () => resolve('');
          r.readAsDataURL(file);
        });
      }
      if (url) insertAtCursor(`\n![${alt}](${url})\n`);
    }
    showToast('Image inserted');
  };

  const handlePickImage = () => imageInputRef.current?.click();

  const runSearch = (q: string) => {
    const view = viewRef.current;
    if (!view || !q) return;
    const hay = view.state.doc.toString().toLowerCase();
    const start = view.state.selection.main.to;
    let idx = hay.indexOf(q.toLowerCase(), start);
    if (idx === -1) idx = hay.indexOf(q.toLowerCase(), 0);
    if (idx === -1) {
      showToast('Not found');
      return;
    }
    view.dispatch({ selection: EditorSelection.range(idx, idx + q.length), scrollIntoView: true });
    view.focus();
  };

  // Keep CodeMirror's keymap (⌘S) and paste/drop pointed at the latest closures.
  handlersRef.current.save = exportMarkdown;
  handlersRef.current.insertImageFiles = insertImageFiles;

  // ⌘K / Ctrl+K focuses the search box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'editor', label: 'Editor' },
    { id: 'history', label: 'Version History' },
    { id: 'signatures', label: 'Signatures' },
    { id: 'previewMode', label: 'Preview Mode' },
  ];

  const showEditor = tab === 'editor' && viewMode !== 'preview';
  const showPreview = tab === 'previewMode' || (tab === 'editor' && viewMode !== 'write');

  return (
    <div className={`flex h-full w-full overflow-hidden ${APP} ${TEXT}`}>
      {/* Hidden picker for image uploads (toolbar + Insert menu trigger it). */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) insertImageFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Transient toast */}
      {toast && (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/85 px-4 py-2 text-sm font-medium text-white shadow-lg dark:bg-white/90 dark:text-black">
          {toast}
        </div>
      )}

      {/* left icon rail */}
      <nav className={`hidden w-14 flex-col items-center gap-1 border-r ${BORDER} ${RAIL} py-4 sm:flex`}>
        <Link href="/" className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${TEXT}`} title="easymd home">
          <Logo className="h-8 w-8" />
        </Link>
        <Link
          href="/dashboard"
          title="All documents"
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${MUTED} ${HOVER} transition`}
        >
          <Icon path={ICONS.folder} />
        </Link>
        <button
          type="button"
          title="Documents"
          onClick={() => setDocMenuOpen((o) => !o)}
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${MUTED} ${HOVER} transition`}
        >
          <Icon path={ICONS.doc} />
        </button>
        <button
          type="button"
          title="Copy share link"
          onClick={copyShareLink}
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${MUTED} ${HOVER} transition`}
        >
          <Icon path={ICONS.users} />
        </button>
        <button
          type="button"
          title="Search (⌘K)"
          onClick={() => searchInputRef.current?.focus()}
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${MUTED} ${HOVER} transition`}
        >
          <Icon path={ICONS.search} />
        </button>
        <div className="mt-auto">
          <button
            type="button"
            title="File menu"
            onClick={() => setFileMenuOpen((o) => !o)}
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${MUTED} ${HOVER} transition`}
          >
            <Icon path={ICONS.settings} />
          </button>
        </div>
      </nav>

      {/* main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* top bar */}
        <header className={`flex h-14 items-center gap-3 border-b ${BORDER} ${PANEL} px-4`}>
          <div className="relative">
            <button
              type="button"
              onClick={() => setDocMenuOpen((o) => !o)}
              className={`flex items-center gap-2 rounded-lg border ${BORDER} ${HOVER} px-2.5 py-1.5`}
            >
              <Logo className={`h-5 w-5 ${TEXT}`} />
              <span className="max-w-[160px] truncate text-sm font-medium">{activeTitle}</span>
              <Icon path={ICONS.chevron} className={`h-4 w-4 ${MUTED2}`} />
            </button>
            {docMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setDocMenuOpen(false)} />
                <div className={`absolute left-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-lg border ${BORDER} ${PANEL} shadow-lg`}>
                  <div className={`max-h-72 overflow-auto thin-scroll py-1`}>
                    {docs.length === 0 && <p className={`px-3 py-2 text-xs ${MUTED2}`}>No documents yet.</p>}
                    {docs.map((d) => (
                      <button
                        key={d.name}
                        type="button"
                        onClick={() => {
                          setActiveDoc(d.name);
                          setDocMenuOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${HOVER} ${
                          d.name === activeDoc ? `font-medium ${ACCENT}` : MUTED
                        }`}
                      >
                        <Icon path={ICONS.doc} className="h-4 w-4 shrink-0" />
                        <span className="truncate">{docLabel(d.name, d.title)}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={createDoc}
                    className={`flex w-full items-center gap-2 border-t ${BORDER} px-3 py-2.5 text-left text-sm font-medium ${ACCENT} ${HOVER}`}
                  >
                    <span className="text-base leading-none">＋</span> New document
                  </button>
                </div>
              </>
            )}
          </div>

          {/* File / Insert menus (Google-Docs style) */}
          <div className="hidden items-center gap-0.5 sm:flex">
            <div className="relative">
              <button
                type="button"
                onClick={() => { setFileMenuOpen((o) => !o); setInsertMenuOpen(false); }}
                className={`rounded-md px-2.5 py-1.5 text-sm ${fileMenuOpen ? ACCENT_SOFT : ''} ${HOVER}`}
              >
                File
              </button>
              {fileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setFileMenuOpen(false)} />
                  <div className={`absolute left-0 top-full z-20 mt-1 w-60 overflow-hidden rounded-lg border ${BORDER} ${PANEL} py-1 shadow-lg`}>
                    <MenuItem label="New document" onClick={() => { setFileMenuOpen(false); createDoc(); }} />
                    <MenuItem label="Rename…" onClick={() => { setFileMenuOpen(false); renameDoc(); }} />
                    <MenuItem label="Share…" onClick={() => { setFileMenuOpen(false); shareDoc(); }} />
                    <MenuItem label="Duplicate" onClick={() => { setFileMenuOpen(false); duplicateDoc(); }} />
                    <Divider />
                    <MenuItem label="Download Markdown (.md)" hint="⌘S" onClick={() => { setFileMenuOpen(false); exportMarkdown(); }} />
                    <MenuItem label="Export HTML (.html)" onClick={() => { setFileMenuOpen(false); exportHtml(); }} />
                    <MenuItem label="Copy as Markdown" onClick={() => { setFileMenuOpen(false); copyMarkdown(); }} />
                    <MenuItem label="Copy share link" onClick={() => { setFileMenuOpen(false); copyShareLink(); }} />
                    <Divider />
                    <MenuItem label="Print…" hint="⌘P" onClick={() => { setFileMenuOpen(false); printDoc(); }} />
                    <Divider />
                    <MenuItem label="Delete document" danger onClick={() => { setFileMenuOpen(false); deleteDoc(); }} />
                  </div>
                </>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => { setInsertMenuOpen((o) => !o); setFileMenuOpen(false); }}
                className={`rounded-md px-2.5 py-1.5 text-sm ${insertMenuOpen ? ACCENT_SOFT : ''} ${HOVER}`}
              >
                Insert
              </button>
              {insertMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setInsertMenuOpen(false)} />
                  <div className={`absolute left-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-lg border ${BORDER} ${PANEL} py-1 shadow-lg`}>
                    <MenuItem label="Image…" onClick={() => { setInsertMenuOpen(false); handlePickImage(); }} />
                    <MenuItem label="Link" onClick={() => { setInsertMenuOpen(false); insertLink(); }} />
                    <MenuItem label="Table" onClick={() => { setInsertMenuOpen(false); insertAtCursor('\n| Column A | Column B |\n| --- | --- |\n| Cell | Cell |\n'); }} />
                    <MenuItem label="Code block" onClick={() => { setInsertMenuOpen(false); insertAtCursor('\n```\ncode\n```\n'); }} />
                    <MenuItem label="Horizontal rule" onClick={() => { setInsertMenuOpen(false); insertAtCursor('\n\n---\n\n'); }} />
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="relative mx-auto hidden w-full max-w-md items-center md:flex">
            <span className={`pointer-events-none absolute left-3 ${MUTED2}`}>
              <Icon path={ICONS.search} className="h-4 w-4" />
            </span>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search document"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  runSearch((e.target as HTMLInputElement).value);
                } else if (e.key === 'Escape') {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className={`w-full rounded-lg border ${BORDER} ${APP} py-1.5 pl-9 pr-12 text-sm ${TEXT} placeholder:text-[#80868b] focus:border-[var(--accent-strong)] focus:outline-none`}
            />
            <span className={`absolute right-3 text-xs ${MUTED2}`}>⌘K</span>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <div className="ml-1">
              <UserButton />
            </div>
          </div>
        </header>

        {/* tabs */}
        <div className={`flex items-center gap-1 border-b ${BORDER} ${PANEL} px-4`}>
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative px-3 py-2.5 text-sm transition ${tab === t.id ? `font-medium ${TEXT}` : `${MUTED} hover:opacity-80`}`}
            >
              {t.label}
              {tab === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--accent)] dark:bg-[var(--accent-strong)]" />}
            </button>
          ))}
        </div>

        {/* title row */}
        <div className={`flex flex-wrap items-center gap-3 border-b ${BORDER} ${PANEL} px-5 py-3`}>
          <h1 className="text-xl font-semibold tracking-tight">{activeTitle}</h1>
          <span className={`flex items-center gap-1.5 text-xs ${MUTED2}`}>
            <Icon path={ICONS.clock} className="h-3.5 w-3.5" />
            Synced live · agent-editable
          </span>
          <div className="ml-auto flex items-center gap-2">
            <span className={`flex items-center gap-1.5 rounded-md border ${BORDER} px-2.5 py-1 text-xs font-medium ${MUTED}`}>
              <span className="h-2 w-2 rounded-full bg-amber-400" /> Drafting
            </span>
            <span className={`flex items-center gap-1.5 text-xs font-medium ${statusMeta.text}`}>
              <span className={`h-2 w-2 rounded-full ${statusMeta.dot}`} />
              {statusMeta.label}
            </span>
          </div>
        </div>

        {/* toolbar */}
        {tab === 'editor' && (
          <div className={`flex flex-wrap items-center gap-1 border-b ${BORDER} ${PANEL} px-4 py-1.5`}>
            <ToolbarBtn title="Undo" onClick={() => viewRef.current && undo(viewRef.current)} icon={ICONS.undo} />
            <ToolbarBtn title="Redo" onClick={() => viewRef.current && redo(viewRef.current)} icon={ICONS.redo} />
            <Sep />
            <div className={`flex items-center rounded-md border ${BORDER}`}>
              <button type="button" onClick={() => setZoom((z) => Math.max(60, z - 10))} className={`px-2 py-1 ${MUTED} ${HOVER}`}>−</button>
              <span className={`w-12 text-center text-xs ${MUTED}`}>{zoom}%</span>
              <button type="button" onClick={() => setZoom((z) => Math.min(180, z + 10))} className={`px-2 py-1 ${MUTED} ${HOVER}`}>+</button>
            </div>
            <Sep />
            <select
              onChange={(e) => { setHeading(Number(e.target.value)); e.target.selectedIndex = 0; }}
              className={`rounded-md border ${BORDER} ${PANEL} px-2 py-1 text-sm ${TEXT} focus:outline-none`}
              defaultValue=""
            >
              <option value="" disabled>Paragraph style</option>
              <option value="0">Paragraph text</option>
              <option value="1">Heading 1</option>
              <option value="2">Heading 2</option>
              <option value="3">Heading 3</option>
            </select>
            <Sep />
            <ToolbarBtn title="Bold" onClick={() => wrapInline('**')} icon={ICONS.bold} />
            <ToolbarBtn title="Italic" onClick={() => wrapInline('_')} icon={ICONS.italic} />
            <ToolbarBtn title="Strikethrough" onClick={() => wrapInline('~~')} icon={ICONS.strike} />
            <ToolbarBtn title="Inline code" onClick={() => wrapInline('`')} icon={ICONS.code} />
            <Sep />
            <ToolbarBtn title="Heading" onClick={() => setHeading(2)} icon={ICONS.hash} />
            <ToolbarBtn title="Bullet list" onClick={() => applyLinePrefix((t) => `- ${t.replace(/^[-*]\s+/, '')}`)} icon={ICONS.list} />
            <ToolbarBtn title="Numbered list" onClick={() => applyLinePrefix((t) => `1. ${t.replace(/^\d+\.\s+/, '')}`)} icon={ICONS.olist} />
            <ToolbarBtn title="Quote" onClick={() => applyLinePrefix((t) => `> ${t.replace(/^>\s+/, '')}`)} icon={ICONS.quote} />
            <ToolbarBtn title="Link" onClick={insertLink} icon={ICONS.link} />
            <ToolbarBtn title="Insert image (upload, paste, or drop)" onClick={handlePickImage} icon={ICONS.image} />

            <div className={`ml-auto flex items-center rounded-md border ${BORDER} p-0.5 text-xs`}>
              {(['write', 'split', 'preview'] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setViewMode(m)}
                  className={`rounded px-2.5 py-1 capitalize transition ${viewMode === m ? `${ACCENT_SOFT} font-medium ${ACCENT}` : `${MUTED} ${HOVER}`}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* body */}
        <div className="flex min-h-0 flex-1">
          <div className={`flex min-w-0 flex-1 overflow-auto thin-scroll ${APP} p-3`}>
            {tab === 'history' && <EmptyState icon={ICONS.clock} title="Version history" body="Every edit is synced live and persisted to Supabase. A full revision timeline isn’t wired up yet." />}
            {tab === 'signatures' && <EmptyState icon={ICONS.pen} title="Signatures" body="E-signature collection isn’t wired up yet. The document itself stays canonical markdown." />}

            {/* Editor + preview stay mounted across view-mode and tab changes; panes are
                kept in flow and collapsed to zero width (rather than unmounted) so the
                CodeMirror instance survives and the resize between write/split/preview
                animates smoothly. */}
            <div
              className={`${tab === 'editor' || tab === 'previewMode' ? 'flex' : 'hidden'} h-full w-full ${
                showEditor && showPreview ? 'gap-3' : 'gap-0'
              }`}
            >
              <section
                className={`${
                  showEditor ? 'flex-1 opacity-100' : 'flex-[0_0_0%] opacity-0'
                } min-w-0 overflow-hidden rounded-xl border ${BORDER} ${CANVAS} shadow-sm transition-all duration-300 ease-in-out`}
              >
                <div className="demo-editor h-full min-h-[60vh]" style={{ ['--zoom' as string]: zoom / 100 }}>
                  <div ref={editorRef} className="h-full" />
                </div>
              </section>
              <section
                className={`${
                  showPreview ? 'flex-1 opacity-100' : 'flex-[0_0_0%] opacity-0'
                } min-w-0 overflow-auto thin-scroll rounded-xl border ${BORDER} ${CANVAS} shadow-sm transition-all duration-300 ease-in-out`}
              >
                <article className="markdown-preview mx-auto max-w-2xl p-10" dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </section>
            </div>
          </div>

          {/* right outline panel */}
          {tab === 'editor' && (
            <aside className={`hidden w-72 flex-col border-l ${BORDER} ${PANEL} lg:flex`}>
              <div className={`border-b ${BORDER} px-4 py-3`}>
                <p className="text-sm font-semibold">Document outline</p>
                <p className={`mt-0.5 text-xs ${MUTED2}`}>{peerCount} editor{peerCount === 1 ? '' : 's'} live</p>
              </div>
              <div className="min-h-0 flex-1 overflow-auto thin-scroll p-2">
                {headings.length === 0 ? (
                  <p className={`px-2 py-4 text-xs ${MUTED2}`}>Add headings (#, ##, ###) to build an outline.</p>
                ) : (
                  <ul className="space-y-0.5">
                    {headings.map((h, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => goToHeading(h.line)}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${MUTED} ${HOVER} transition`}
                          style={{ paddingLeft: `${(h.level - 1) * 12 + 8}px` }}
                        >
                          <span className={ACCENT}>{'#'.repeat(h.level)}</span>
                          <span className="truncate">{h.text || 'Untitled'}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className={`border-t ${BORDER} px-4 py-3 text-xs ${MUTED2}`}>
                Open this page in another tab to see live cursors.
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolbarBtn({ title, onClick, icon }: { title: string; onClick: () => void; icon: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-md ${MUTED} ${HOVER} transition`}
    >
      <Icon path={icon} />
    </button>
  );
}

function Sep() {
  return <span className={`mx-1 h-5 w-px ${BORDER} border-l`} />;
}

function MenuItem({ label, hint, onClick, danger }: { label: string; hint?: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-4 px-3 py-2 text-left text-sm ${HOVER} ${
        danger ? 'text-red-600 dark:text-red-400' : TEXT
      }`}
    >
      <span>{label}</span>
      {hint && <span className={`text-xs ${MUTED2}`}>{hint}</span>}
    </button>
  );
}

function Divider() {
  return <div className={`my-1 border-t ${BORDER}`} />;
}

function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className={`m-auto max-w-sm rounded-xl border border-dashed ${BORDER} ${CANVAS} p-10 text-center`}>
      <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${ACCENT_SOFT} ${ACCENT}`}>
        <Icon path={icon} className="h-6 w-6" />
      </span>
      <h3 className={`mt-4 text-base font-semibold ${TEXT}`}>{title}</h3>
      <p className={`mt-2 text-sm ${MUTED}`}>{body}</p>
    </div>
  );
}
