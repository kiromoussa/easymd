import http from 'http';
import crypto from 'crypto';
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

// Render/Heroku-style hosts inject PORT; fall back to COLLAB_PORT then the local default.
const PORT = Number(process.env.PORT || process.env.COLLAB_PORT || 3848);
const DEMO_NAME = 'easymd-demo';
const PERSIST_DEBOUNCE_MS = 500;
const TABLE = 'documents';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const COLLAB_SECRET = process.env.COLLAB_SECRET || '';

// Verify a room access ticket ("<exp>.<hmac>") issued by the Next API (browsers) or
// self-minted by the MCP server. Returns true if the signature matches the room and
// the ticket hasn't expired. When COLLAB_SECRET is unset, auth is disabled (dev only).
function ticketValid(room, ticket) {
  if (!COLLAB_SECRET) return true; // no secret configured → open (logs a warning at startup)
  if (!ticket || typeof ticket !== 'string') return false;
  const dot = ticket.indexOf('.');
  if (dot === -1) return false;
  const exp = Number(ticket.slice(0, dot));
  const sig = ticket.slice(dot + 1);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = crypto.createHmac('sha256', COLLAB_SECRET).update(`${room}.${exp}`).digest('hex');
  if (sig.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

const DEMO_CONTENT = `# Welcome to easymd

You're editing real markdown — the same format your agents read.

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

// The owner is encoded in the room name as "<owner_id>__<slug>" (see API + MCP).
const ownerOf = (name) => (name.includes('__') ? name.split('__')[0] : null);

async function saveState(name, ydoc) {
  if (!supabase) return;
  const state = Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString('base64');
  // Persist owner_id (derived from the room name) so docs created live — e.g. by an
  // agent over MCP — are scoped to the right account. `title` is intentionally left
  // untouched here so a friendlier title set via the API/MCP is never clobbered.
  const row = { name, state, updated_at: new Date().toISOString() };
  const owner = ownerOf(name);
  if (owner) row.owner_id = owner;
  const { error } = await supabase.from(TABLE).upsert(row, { onConflict: 'name' });
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
    // Seed the welcome document on first run. Each account gets its own room,
    // named "<owner_id>__welcome", so the starter content is per-account.
    const ytext = ydoc.getText('markdown');
    if ((docName === DEMO_NAME || docName.endsWith('__welcome')) && ytext.length === 0) {
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
wss.on('connection', (ws, req) => {
  let room = '';
  let ticket = '';
  try {
    const u = new URL(req.url, 'http://localhost');
    room = decodeURIComponent(u.pathname.slice(1));
    ticket = u.searchParams.get('ticket') || '';
  } catch {
    /* malformed url → treated as unauthorized below */
  }
  if (!ticketValid(room, ticket)) {
    ws.close(1008, 'unauthorized');
    return;
  }
  setupWSConnection(ws, req, { gc: false });
});

// If another easymd dev server already holds the collab port, don't crash and don't
// spawn a competing server on a different port (which would split rooms and break the
// fixed ws://…:PORT URL that browsers, the MCP server, and the CLI all connect to).
// Instead, reuse the existing one: stay alive and idle so `concurrently -k` keeps this
// instance's Next dev running, and it simply connects to the collab already on PORT.
let reusing = false;
const onPortClash = (err) => {
  if (err.code !== 'EADDRINUSE') throw err;
  if (reusing) return;
  reusing = true;
  console.warn(`\nℹ️  Collab server already running on ${PORT} — reusing it (this dev instance will share it).\n`);
  setInterval(() => {}, 1 << 30); // keep the process alive so the sibling Next dev isn't torn down
};
// The error surfaces on both the HTTP server (from listen) and the WebSocketServer.
server.on('error', onPortClash);
wss.on('error', onPortClash);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Collab server listening on ws://localhost:${PORT}`);
  console.log(supabase ? `Persistence: Supabase (durable) → ${SUPABASE_URL}` : 'Persistence: in-memory only (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).');
  console.log(COLLAB_SECRET ? 'Auth: ticket-gated (COLLAB_SECRET set).' : 'Auth: DISABLED — set COLLAB_SECRET to require access tickets.');
});

function shutdown() {
  for (const t of timers.values()) clearTimeout(t);
  server.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
