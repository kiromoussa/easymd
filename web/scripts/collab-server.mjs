import http from 'http';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { WebSocketServer } from 'ws';
import { getYDoc, setupWSConnection } from 'y-websocket/bin/utils';
import { createClient } from '@supabase/supabase-js';

// IMPORTANT: load Yjs from the SAME CommonJS instance that y-websocket/bin/utils
// uses (require('yjs') → dist/yjs.cjs). Importing the ESM build (`import * as Y`)
// loads a second Yjs copy ("Yjs was already imported"), and encoding a doc owned by
// one instance with the other silently drops edits. createRequire guarantees one copy.
const require = createRequire(import.meta.url);
const Y = require('yjs');

// Load web/.env.local so this standalone process (spawned by `concurrently`, not
// Next.js) picks up config during local development. In production the values come
// from the real environment, so a missing file is fine.
try {
  process.loadEnvFile(fileURLToPath(new URL('../.env.local', import.meta.url)));
} catch {
  // no .env.local — rely on the ambient environment
}

const PORT = Number(process.env.COLLAB_PORT || 3848);
const DOC_NAME = 'easymd-demo';
const PERSIST_DEBOUNCE_MS = 500;
const TABLE = 'documents';

// Durable persistence is backed by Supabase. The collab server runs server-side and
// uses the SERVICE ROLE key (never exposed to the browser), which bypasses RLS.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const DEMO_CONTENT = `# CLAUDE.md — Live demo

Welcome to **easymd**. You're editing real markdown — the same format your agents read.

## Why teams switch from Docs → .md

Converting heavy formats to clean Markdown cuts token usage dramatically:

| Source format | Typical token savings |
|---------------|----------------------|
| Raw HTML | 75–90% |
| Word / DOCX | 50–70% |
| Text-based PDF | 40–65% |

## What markdown removes

- **Dead weight** — font styles, XML tags, and CSS bloat disappear
- **Binary bloat** — no OCR or embedded structures; pure text for the model
- **Conversational bloat** — reference \`@CLAUDE.md\` on demand instead of pasting every prompt

## Try it with a teammate

Open this demo in two browser tabs. Edits sync in real time — live cursors, no pull request.

> The canonical file stays in your repo. This demo persists to Supabase; \`easymd open CLAUDE.md\` writes straight to disk.
`;

/**
 * Supabase-backed persistence for Yjs documents.
 * State is stored base64-encoded in the public.documents table.
 * Returns null when Supabase is not configured (in-memory fallback for quick dev).
 */
function createSupabasePersistence(url, serviceRoleKey) {
  if (!url || !serviceRoleKey) return null;

  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    async load(name) {
      const { data, error } = await client
        .from(TABLE)
        .select('state')
        .eq('name', name)
        .maybeSingle();
      if (error) throw new Error(`Supabase load failed: ${error.message}`);
      if (!data?.state) return null;
      return new Uint8Array(Buffer.from(data.state, 'base64'));
    },
    async save(name, ydoc) {
      const state = Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString('base64');
      const { error } = await client
        .from(TABLE)
        .upsert({ name, state, updated_at: new Date().toISOString() }, { onConflict: 'name' });
      if (error) throw new Error(`Supabase save failed: ${error.message}`);
    },
  };
}

const db = createSupabasePersistence(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const ydoc = getYDoc(DOC_NAME, false);
const ytext = ydoc.getText('markdown');

if (db) {
  const persisted = await db.load(DOC_NAME);
  if (persisted && persisted.length > 0) {
    Y.applyUpdate(ydoc, persisted);
    console.log(`Loaded "${DOC_NAME}" from Supabase (${persisted.length} bytes).`);
  }
}

// Seed first-run content if the document is empty (no persisted copy yet).
if (ytext.length === 0) {
  ytext.insert(0, DEMO_CONTENT);
}

let persistTimer = null;
if (db) {
  // Persist the initial state, then debounce-persist on every edit.
  await db.save(DOC_NAME, ydoc).catch((err) => console.error('Initial persist failed:', err.message));

  ydoc.on('update', () => {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      db.save(DOC_NAME, ydoc).catch((err) => console.error('Persist failed:', err.message));
    }, PERSIST_DEBOUNCE_MS);
  });
  console.log(`Persistence: Supabase (durable) → ${SUPABASE_URL}`);
} else {
  console.warn(
    'Persistence: in-memory only. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to persist documents to Supabase.',
  );
}

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('easymd collab server');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  setupWSConnection(ws, req, { docName: DOC_NAME, gc: false });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Collab server listening on ws://localhost:${PORT}`);
});

async function shutdown() {
  clearTimeout(persistTimer);
  if (db) {
    try {
      await db.save(DOC_NAME, ydoc);
    } catch (err) {
      console.error('Shutdown persist failed:', err.message);
    }
  }
  server.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
