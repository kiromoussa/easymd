'use client';

import { useCallback, useEffect, useState, type MutableRefObject } from 'react';
import * as Y from 'yjs';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { yCollab } from 'y-codemirror.next';
import { useRoom } from '@liveblocks/react';
import { getYjsProviderForRoom } from '@liveblocks/yjs';

type Handlers = { save: () => void; insertImageFiles: (f: FileList | File[]) => void };

// CodeMirror bound to the room's Liveblocks-Yjs document. Mounted inside a RoomProvider.
export function EditorCanvas({
  viewRef,
  onText,
  onStatus,
  onPeers,
  handlersRef,
  userName,
  userColor,
}: {
  viewRef: MutableRefObject<EditorView | null>;
  onText: (text: string) => void;
  onStatus: (s: 'connecting' | 'connected' | 'disconnected') => void;
  onPeers: (n: number) => void;
  handlersRef: MutableRefObject<Handlers>;
  userName: string;
  userColor: string;
}) {
  const room = useRoom();
  const [element, setElement] = useState<HTMLElement | null>(null);
  const ref = useCallback((node: HTMLElement | null) => setElement(node), []);

  useEffect(() => {
    if (!element || !room) return;
    const yProvider = getYjsProviderForRoom(room);
    const yDoc = yProvider.getYDoc();
    const yText = yDoc.getText('codemirror');
    const undoManager = new Y.UndoManager(yText);

    yProvider.awareness.setLocalStateField('user', { name: userName, color: userColor });
    const syncCb = () => onStatus('connected');
    yProvider.on('sync', syncCb);
    onStatus('connecting');
    const updatePeers = () => onPeers(yProvider.awareness.getStates().size);
    yProvider.awareness.on('change', updatePeers);
    updatePeers();

    const view = new EditorView({
      parent: element,
      state: EditorState.create({
        doc: yText.toString(),
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
          yCollab(yText, yProvider.awareness, { undoManager }),
          EditorView.lineWrapping,
          EditorView.domEventHandlers({
            paste: (e) => {
              const files = e.clipboardData?.files;
              if (files?.length && Array.from(files).some((f) => f.type.startsWith('image/'))) {
                handlersRef.current.insertImageFiles(files);
                e.preventDefault();
                return true;
              }
              return false;
            },
            drop: (e) => {
              const files = e.dataTransfer?.files;
              if (files?.length && Array.from(files).some((f) => f.type.startsWith('image/'))) {
                handlersRef.current.insertImageFiles(files);
                e.preventDefault();
                return true;
              }
              return false;
            },
          }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onText(u.state.doc.toString());
          }),
          EditorView.theme({ '&': { height: '100%', backgroundColor: 'transparent' } }),
        ],
      }),
    });
    viewRef.current = view;
    onText(view.state.doc.toString());

    return () => {
      view.destroy();
      viewRef.current = null;
      yProvider.off('sync', syncCb);
      yProvider.awareness.off('change', updatePeers);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element, room]);

  return <div ref={ref} className="h-full" />;
}
