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

const COLORS = ['#1a73e8', '#34a853', '#fbbc04', '#ea4335', '#9334e6', '#00acc1'];
const DOC_NAME = 'easymd-demo';
const WS_URL = process.env.NEXT_PUBLIC_COLLAB_WS_URL || 'ws://localhost:3848';

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
const ACCENT = 'text-[#1a73e8] dark:text-[#4c8dff]';
const ACCENT_SOFT = 'bg-[#1a73e8]/10 dark:bg-[#4c8dff]/20';

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

export function DemoEditor() {
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
    if (!editorRef.current || viewRef.current) return;

    const ydoc = new Y.Doc();
    const ytext = ydoc.getText('markdown');
    const provider = new WebsocketProvider(WS_URL, DOC_NAME, ydoc);
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
        keymap.of([...defaultKeymap, ...historyKeymap]),
        yCollab(ytext, provider.awareness, { undoManager }),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) refreshDerived(update.state.doc.toString());
        }),
        EditorView.theme({ '&': { height: '100%', backgroundColor: 'transparent' } }),
      ],
    });

    const view = new EditorView({ state, parent: editorRef.current });
    viewRef.current = view;
    refreshDerived(view.state.doc.toString());

    return () => {
      view.destroy();
      provider.destroy();
      ydoc.destroy();
      viewRef.current = null;
      providerRef.current = null;
    };
  }, [user, refreshDerived]);

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
      {/* left icon rail */}
      <nav className={`hidden w-14 flex-col items-center gap-1 border-r ${BORDER} ${RAIL} py-4 sm:flex`}>
        <Link href="/" className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[#1a73e8] text-sm font-bold text-white" title="easymd home">
          e
        </Link>
        {[ICONS.doc, ICONS.folder, ICONS.users, ICONS.search].map((p, i) => (
          <button key={i} type="button" className={`flex h-9 w-9 items-center justify-center rounded-lg ${MUTED} ${HOVER} transition`} tabIndex={-1}>
            <Icon path={p} />
          </button>
        ))}
        <div className="mt-auto">
          <button type="button" className={`flex h-9 w-9 items-center justify-center rounded-lg ${MUTED} ${HOVER} transition`} tabIndex={-1}>
            <Icon path={ICONS.settings} />
          </button>
        </div>
      </nav>

      {/* main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* top bar */}
        <header className={`flex h-14 items-center gap-3 border-b ${BORDER} ${PANEL} px-4`}>
          <div className={`flex items-center gap-2 rounded-lg border ${BORDER} px-2.5 py-1.5`}>
            <span className="flex h-5 w-5 items-center justify-center rounded bg-[#1a73e8] text-[10px] font-bold text-white">e</span>
            <span className="text-sm font-medium">easymd</span>
            <Icon path={ICONS.chevron} className={`h-4 w-4 ${MUTED2}`} />
          </div>

          <div className="relative mx-auto hidden w-full max-w-md items-center md:flex">
            <span className={`pointer-events-none absolute left-3 ${MUTED2}`}>
              <Icon path={ICONS.search} className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder="Search document"
              className={`w-full rounded-lg border ${BORDER} ${APP} py-1.5 pl-9 pr-12 text-sm ${TEXT} placeholder:text-[#80868b] focus:border-[#1a73e8] focus:outline-none`}
            />
            <span className={`absolute right-3 text-xs ${MUTED2}`}>⌘K</span>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <div className="ml-1">
              <UserButton afterSignOutUrl="/" />
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
              {tab === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#1a73e8] dark:bg-[#4c8dff]" />}
            </button>
          ))}
        </div>

        {/* title row */}
        <div className={`flex flex-wrap items-center gap-3 border-b ${BORDER} ${PANEL} px-5 py-3`}>
          <h1 className="text-xl font-semibold tracking-tight">NDA — Agreement</h1>
          <span className={`flex items-center gap-1.5 text-xs ${MUTED2}`}>
            <Icon path={ICONS.clock} className="h-3.5 w-3.5" />
            Synced live
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
            <ToolbarBtn title="Image" onClick={() => wrapInline('![alt](', 'https://)')} icon={ICONS.image} />

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
          <div className={`flex min-w-0 flex-1 justify-center overflow-auto thin-scroll ${APP} p-6`}>
            {tab === 'history' && <EmptyState icon={ICONS.clock} title="Version history" body="Every edit is synced live and persisted to Supabase. A full revision timeline isn’t part of this demo yet." />}
            {tab === 'signatures' && <EmptyState icon={ICONS.pen} title="Signatures" body="E-signature collection isn’t wired up in this demo. The document itself stays canonical markdown." />}

            {(tab === 'editor' || tab === 'previewMode') && (
              <div className="flex w-full max-w-5xl gap-6">
                {showEditor && (
                  <section className={`${viewMode === 'split' ? 'flex-1' : 'mx-auto w-full max-w-3xl'} overflow-hidden rounded-xl border ${BORDER} ${CANVAS} shadow-sm`}>
                    <div className="demo-editor h-full min-h-[60vh]" style={{ ['--zoom' as string]: zoom / 100 }}>
                      <div ref={editorRef} className="h-full" />
                    </div>
                  </section>
                )}
                {showPreview && (
                  <section className={`${viewMode === 'split' ? 'flex-1' : 'mx-auto w-full max-w-3xl'} overflow-auto thin-scroll rounded-xl border ${BORDER} ${CANVAS} p-10 shadow-sm`}>
                    <article className="markdown-preview mx-auto max-w-2xl" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  </section>
                )}
              </div>
            )}
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
