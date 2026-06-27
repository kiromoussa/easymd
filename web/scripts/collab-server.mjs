import http from 'http';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { WebSocketServer } from 'ws';
import { getYDoc, setupWSConnection } from 'y-websocket/bin/utils';
import pg from 'pg';

// IMPORTANT: load Yjs from the SAME CommonJS instance that y-websocket/bin/utils
// uses (require('yjs') → dist/yjs.cjs). Importing the ESM build (`import * as Y`)
// loads a second Yjs copy ("Yjs was already imported"), and encoding a doc owned by
// one instance with the other silently drops edits. createRequire guarantees one copy.
const require = createRequire(import.meta.url);
const Y = require('yjs');

// Load web/.env.local so this standalone process (spawned by `concurrently`, not
// Next.js) picks up COLLAB_DATABASE_URL / COLLAB_PORT during local development.
// In production the values come from the real environment, so a missing file is fine.
try {
  process.loadEnvFile(fileURLToPath(new URL('../.env.local', import.meta.url)));
} catch {
  // no .env.local — rely on the ambient environment
}

const PORT = Number(process.env.COLLAB_PORT || 3848);
const DOC_NAME = 'easymd-demo';
const PERSIST_DEBOUNCE_MS = 500;

// Production: set COLLAB_DATABASE_URL to your Supabase Postgres connection string
// (Supabase dashboard → Project Settings → Database → Connection string, include
// `?sslmode=require`). Without it the server runs in-memory (documents reset on restart).
const DATABASE_URL = process.env.COLLAB_DATABASE_URL || process.env.SUPABASE_DB_URL || '';

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
 * Postgres-backed persistence for Yjs documents (stored in Supabase).
 * Returns null when no database is configured (in-memory fallback for quick dev).
 */
function createDbPersistence(connectionString) {
  if (!connectionString) return null;

  const needsSsl = /sslmode=require/i.test(connectionString) || /supabase\.(co|com)/i.test(connectionString);
  const pool = new pg.Pool({
    connectionString,
    max: 4,
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });

  return {
    async load(name) {
      const { rows } = await pool.query('select state from documents where name = $1', [name]);
      return rows[0]?.state ?? null; // bytea → Buffer (a Uint8Array)
    },
    async save(name, ydoc) {
      const state = Buffer.from(Y.encodeStateAsUpdate(ydoc));
      await pool.query(
        `insert into documents (name, state, updated_at)
         values ($1, $2, now())
         on conflict (name) do update set state = excluded.state, updated_at = now()`,
        [name, state],
      );
    },
    async close() {
      await pool.end();
    },
  };
}

const db = createDbPersistence(DATABASE_URL);

const ydoc = getYDoc(DOC_NAME, false);
const ytext = ydoc.getText('markdown');

if (db) {
  try {
    const persisted = await db.load(DOC_NAME);
    if (persisted && persisted.length > 0) {
      Y.applyUpdate(ydoc, persisted);
      console.log(`Loaded "${DOC_NAME}" from Supabase (${persisted.length} bytes).`);
    }
  } catch (err) {
    console.error('Failed to load document from Supabase:', err.message);
    process.exitCode = 1;
    throw err;
  }
}

// Seed first-run content if the document is empty (no disk/db copy yet).
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
  console.log('Persistence: Supabase Postgres (durable).');
} else {
  console.warn('Persistence: in-memory only. Set COLLAB_DATABASE_URL to persist documents to Supabase.');
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
      await db.close();
    } catch (err) {
      console.error('Shutdown persist failed:', err.message);
    }
  }
  server.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
