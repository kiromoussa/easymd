import http from 'http';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { WebSocketServer } from 'ws';
import { getYDoc, setupWSConnection, setPersistence } from 'y-websocket/bin/utils';
import { createClient } from '@supabase/supabase-js';

// Load Yjs from the SAME CommonJS instance y-websocket uses (see note in mcp/sync code).
const require = createRequire(import.meta.url);
const Y = require('yjs');

// Load web/.env.local for standalone runs (spawned by concurrently, not Next.js).
try {
  process.loadEnvFile(fileURLToPath(new URL('../.env.local', import.meta.url)));
} catch {
  /* rely on ambient environment */
}

const PORT = Number(process.env.COLLAB_PORT || 3848);
const DEMO_NAME = 'easymd-demo';
const PERSIST_DEBOUNCE_MS = 500;
const TABLE = 'documents';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

const DEMO_CONTENT = `# CLAUDE.md — Live demo

Welcome to **easymd**. You're editing real markdown — the same format your agents read.

## Why teams switch from Docs → .md

Converting heavy formats to clean Markdown cuts token usage dramatically:

| Source format | Typical token savings |
|---------------|----------------------|
| Raw HTML | 75–90% |
| Word / DOCX | 50–70% |
| Text-based PDF | 40–65% |

## Agents are first-class

An MCP server can read, create, and edit these same documents. Changes an agent makes
appear here live, and edits humans make are visible to the agent — one shared file.
`;

async function loadState(name) {
  if (!supabase) return null;
  const { data, error } = await supabase.from(TABLE).select('state').eq('name', name).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.state ? new Uint8Array(Buffer.from(data.state, 'base64')) : null;
}

async function saveState(name, ydoc) {
  if (!supabase) return;
  const state = Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString('base64');
  const { error } = await supabase
    .from(TABLE)
    .upsert({ name, state, updated_at: new Date().toISOString() }, { onConflict: 'name' });
  if (error) throw new Error(error.message);
}

const timers = new Map();
function scheduleSave(name, ydoc) {
  clearTimeout(timers.get(name));
  timers.set(
    name,
    setTimeout(() => {
      saveState(name, ydoc).catch((err) => console.error(`Persist failed for "${name}":`, err.message));
    }, PERSIST_DEBOUNCE_MS),
  );
}

// Generic Supabase persistence for ANY document room.
setPersistence({
  provider: supabase,
  bindState: async (docName, ydoc) => {
    try {
      const persisted = await loadState(docName);
      if (persisted && persisted.length > 0) Y.applyUpdate(ydoc, persisted);
    } catch (err) {
      console.error(`Load failed for "${docName}":`, err.message);
    }
    // Seed the demo document on first run.
    const ytext = ydoc.getText('markdown');
    if (docName === DEMO_NAME && ytext.length === 0) {
      ytext.insert(0, DEMO_CONTENT);
    }
    // Persist on every change (debounced).
    ydoc.on('update', () => scheduleSave(docName, ydoc));
    if (ytext.length > 0) scheduleSave(docName, ydoc);
  },
  writeState: async (docName, ydoc) => {
    await saveState(docName, ydoc);
  },
});

// Pre-warm the demo doc so it's loaded/seeded before the first browser connects.
getYDoc(DEMO_NAME, false);

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('easymd collab server');
});

const wss = new WebSocketServer({ server });
// Room name comes from the WS URL path (y-websocket convention), enabling multi-document collaboration.
wss.on('connection', (ws, req) => setupWSConnection(ws, req, { gc: false }));

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Collab server listening on ws://localhost:${PORT}`);
  console.log(supabase ? `Persistence: Supabase (durable) → ${SUPABASE_URL}` : 'Persistence: in-memory only (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).');
});

function shutdown() {
  for (const t of timers.values()) clearTimeout(t);
  server.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
