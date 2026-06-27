'use client';

import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { yCollab } from 'y-codemirror.next';
import { marked } from 'marked';
import { useUser } from '@clerk/nextjs';

const COLORS = ['#1a73e8', '#34a853', '#fbbc04', '#ea4335', '#9334e6', '#00acc1'];
const DOC_NAME = 'easymd-demo';
const WS_URL = process.env.NEXT_PUBLIC_COLLAB_WS_URL || 'ws://localhost:3848';

type ViewMode = 'edit' | 'split' | 'preview';

export function DemoEditor() {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const { user } = useUser();
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [previewHtml, setPreviewHtml] = useState('');
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [peerCount, setPeerCount] = useState(1);

  useEffect(() => {
    if (!editorRef.current || viewRef.current) return;

    const ydoc = new Y.Doc();
    const ytext = ydoc.getText('markdown');
    const provider = new WebsocketProvider(WS_URL, DOC_NAME, ydoc);
    providerRef.current = provider;

    const displayName =
      user?.firstName || user?.username || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'You';
    const userColor = COLORS[(displayName.charCodeAt(0) || 0) % COLORS.length];

    provider.awareness.setLocalStateField('user', {
      name: displayName,
      color: userColor,
    });

    provider.on('status', ({ status: s }) => {
      setStatus(s === 'connected' ? 'connected' : 'connecting');
    });
    provider.on('connection-close', () => setStatus('disconnected'));

    const updatePeers = () => {
      setPeerCount(provider.awareness.getStates().size);
    };
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
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            setPreviewHtml(marked.parse(update.state.doc.toString(), { async: false }) as string);
          }
        }),
        EditorView.theme({
          '&': { height: '100%', backgroundColor: 'transparent' },
        }),
      ],
    });

    const view = new EditorView({ state, parent: editorRef.current });
    viewRef.current = view;
    setPreviewHtml(marked.parse(view.state.doc.toString(), { async: false }) as string);

    ytext.observe(() => {
      setPreviewHtml(marked.parse(ytext.toString(), { async: false }) as string);
    });

    return () => {
      view.destroy();
      provider.destroy();
      ydoc.destroy();
      viewRef.current = null;
      providerRef.current = null;
    };
  }, [user]);

  const statusColor =
    status === 'connected' ? 'text-emerald-600' : status === 'connecting' ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 bg-[#f8f9fa] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-700">CLAUDE.md</span>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-[#1a73e8]">
            Live demo
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden text-xs text-slate-500 sm:inline">
            {peerCount} editor{peerCount === 1 ? '' : 's'} connected
          </span>
          <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white text-xs">
            {(['edit', 'split', 'preview'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 capitalize ${
                  viewMode === mode ? 'bg-blue-50 font-medium text-[#1a73e8]' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <span className={`text-xs font-medium ${statusColor}`} title="Sync status">
            {status === 'connected' ? 'Synced' : status === 'connecting' ? 'Connecting…' : 'Offline'}
          </span>
        </div>
      </div>

      <div
        className={`grid min-h-0 flex-1 ${
          viewMode === 'split' ? 'grid-cols-2' : 'grid-cols-1'
        }`}
      >
        {viewMode !== 'preview' && (
          <div className="demo-editor min-h-0 overflow-hidden border-r border-slate-200">
            <div ref={editorRef} className="h-full" />
          </div>
        )}
        {viewMode !== 'edit' && (
          <div className="min-h-0 overflow-auto bg-white p-6">
            <article
              className="markdown-preview mx-auto max-w-2xl"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
