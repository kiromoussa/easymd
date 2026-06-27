import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { yCollab } from 'y-codemirror.next';
import { marked } from 'marked';

const COLORS = ['#58a6ff', '#3fb950', '#d2a8ff', '#f0883e', '#ff7b72', '#79c0ff', '#e3b341'];

const filenameEl = document.getElementById('filename');
const presenceEl = document.getElementById('presence');
const syncStatusEl = document.getElementById('sync-status');
const workspaceEl = document.getElementById('workspace');
const editorPaneEl = document.getElementById('editor-pane');
const previewPaneEl = document.getElementById('preview-pane');
const previewEl = document.getElementById('preview');
const toggleButtons = document.querySelectorAll('.toggle-btn');

function randomName() {
  const names = ['Alex', 'Sam', 'Jordan', 'Riley', 'Casey', 'Morgan', 'Taylor', 'Quinn'];
  return names[Math.floor(Math.random() * names.length)];
}

function colorForUser(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function setSyncStatus(state) {
  syncStatusEl.className = 'sync-status';
  if (state === 'connected') {
    syncStatusEl.textContent = '●';
    syncStatusEl.title = 'Connected — changes save to disk';
  } else if (state === 'connecting') {
    syncStatusEl.classList.add('connecting');
    syncStatusEl.textContent = '●';
    syncStatusEl.title = 'Connecting…';
  } else {
    syncStatusEl.classList.add('disconnected');
    syncStatusEl.textContent = '●';
    syncStatusEl.title = 'Disconnected';
  }
}

function renderPreview(markdownText) {
  previewEl.innerHTML = marked.parse(markdownText, { gfm: true, breaks: false });
}

function setView(mode) {
  workspaceEl.classList.remove('split', 'preview');
  editorPaneEl.classList.remove('hidden');
  previewPaneEl.classList.add('hidden');

  toggleButtons.forEach((btn) => {
    const active = btn.dataset.view === mode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });

  if (mode === 'split') {
    workspaceEl.classList.add('split');
    previewPaneEl.classList.remove('hidden');
  } else if (mode === 'preview') {
    workspaceEl.classList.add('preview');
    previewPaneEl.classList.remove('hidden');
  }
}

toggleButtons.forEach((btn) => {
  btn.addEventListener('click', () => setView(btn.dataset.view));
});

async function init() {
  setSyncStatus('connecting');

  const sessionRes = await fetch('/api/session');
  const session = await sessionRes.json();
  filenameEl.textContent = session.fileName;
  filenameEl.title = session.filePath;
  document.title = `${session.fileName} — easymd`;

  const ydoc = new Y.Doc();
  const ytext = ydoc.getText('markdown');

  const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const provider = new WebsocketProvider(
    `${wsProtocol}//${location.host}`,
    session.docName,
    ydoc,
    { connect: true }
  );

  const userId = crypto.randomUUID();
  const userName = randomName();
  const userColor = colorForUser(userId);

  provider.awareness.setLocalStateField('user', {
    name: userName,
    color: userColor,
  });

  provider.on('status', ({ status }) => {
    setSyncStatus(status === 'connected' ? 'connected' : 'connecting');
  });

  provider.on('connection-close', () => setSyncStatus('disconnected'));

  function renderPresence() {
    const states = provider.awareness.getStates();
    presenceEl.innerHTML = '';

    states.forEach((state) => {
      const user = state.user;
      if (!user) return;
      const avatar = document.createElement('span');
      avatar.className = 'presence-avatar';
      avatar.style.background = user.color;
      avatar.textContent = user.name.slice(0, 1).toUpperCase();
      avatar.title = user.name;
      presenceEl.appendChild(avatar);
    });
  }

  provider.awareness.on('change', renderPresence);
  renderPresence();

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
          renderPreview(update.state.doc.toString());
        }
      }),
      EditorView.theme({
        '&': { backgroundColor: 'transparent', color: 'var(--text)' },
        '.cm-gutters': { backgroundColor: 'var(--bg)', color: 'var(--muted)' },
      }),
    ],
  });

  const view = new EditorView({ state, parent: document.getElementById('editor') });
  renderPreview(view.state.doc.toString());

  ytext.observe(() => {
    renderPreview(ytext.toString());
  });

  return { view, provider };
}

init().catch((err) => {
  console.error(err);
  filenameEl.textContent = 'Failed to connect';
  setSyncStatus('disconnected');
});
