#!/usr/bin/env node
/**
 * easymd MCP server — lets AI agents read, create, and edit the SAME live
 * collaborative markdown documents that humans edit in the browser.
 *
 * It connects to the easymd collab WebSocket server as a Yjs client, so every
 * change an agent makes is broadcast in real time to open editors and persisted
 * to Supabase. New documents created here immediately show up in the app's
 * document switcher for anyone who needs them.
 */
import { fileURLToPath } from 'url';
import WS from 'ws';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { createClient } from '@supabase/supabase-js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// Use the ESM Yjs build — the SAME instance the ESM `y-websocket` import uses.
// (The collab server imports y-websocket/bin/utils, the CJS build, so it pairs with
// require('yjs') instead. Mismatching the two builds silently breaks CRDT sync.)

// Load web/.env.local when run from the web package.
try {
  process.loadEnvFile(fileURLToPath(new URL('../.env.local', import.meta.url)));
} catch {
  /* rely on ambient environment */
}

const WS_URL = process.env.COLLAB_WS_URL || process.env.NEXT_PUBLIC_COLLAB_WS_URL || 'ws://127.0.0.1:3848';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) =>
  String(s)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

/** Open a live collaborative session for `name`, run `fn(ytext)`, flush, close. */
async function withDoc(name, { mutate, fn }) {
  const ydoc = new Y.Doc();
  const provider = new WebsocketProvider(WS_URL, name, ydoc, { WebSocketPolyfill: WS });
  try {
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`Timed out connecting to collab server at ${WS_URL}. Is it running?`)), 10000);
      provider.on('sync', (synced) => synced && (clearTimeout(t), resolve()));
    });
    // Let the server apply persisted state before we read/replace it.
    await sleep(400);
    const ytext = ydoc.getText('markdown');
    const result = fn(ytext, ydoc);
    if (mutate) await sleep(900); // allow the server's debounced Supabase save to flush
    return result;
  } finally {
    provider.destroy();
    ydoc.destroy();
  }
}

async function docExists(name) {
  if (!supabase) return false;
  const { data } = await supabase.from('documents').select('name').eq('name', name).maybeSingle();
  return !!data;
}

const ok = (text) => ({ content: [{ type: 'text', text }] });
const fail = (text) => ({ content: [{ type: 'text', text }], isError: true });

const server = new McpServer({ name: 'easymd', version: '0.1.0' });

server.registerTool(
  'list_documents',
  {
    title: 'List documents',
    description: 'List all easymd collaborative markdown documents (name + last updated). These are the live docs humans edit in the browser.',
    inputSchema: {},
  },
  async () => {
    if (!supabase) return fail('Supabase is not configured (set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).');
    const { data, error } = await supabase.from('documents').select('name, updated_at').order('updated_at', { ascending: false });
    if (error) return fail(`Failed to list documents: ${error.message}`);
    if (!data?.length) return ok('No documents yet. Use create_document to add one.');
    return ok(data.map((d) => `- ${d.name} (updated ${d.updated_at})`).join('\n'));
  },
);

server.registerTool(
  'read_document',
  {
    title: 'Read document',
    description: 'Return the current markdown content of a document by name.',
    inputSchema: { name: z.string().describe('Document name, e.g. "easymd-demo" or "product-spec"') },
  },
  async ({ name }) => {
    const doc = slug(name);
    if (supabase && !(await docExists(doc))) return fail(`Document "${doc}" does not exist. Use list_documents to see options.`);
    try {
      const text = await withDoc(doc, { mutate: false, fn: (ytext) => ytext.toString() });
      return ok(text || '(empty document)');
    } catch (e) {
      return fail(e.message);
    }
  },
);

server.registerTool(
  'create_document',
  {
    title: 'Create document',
    description: 'Create a new collaborative markdown document. It immediately appears in the app for everyone and can be edited live by humans and agents.',
    inputSchema: {
      name: z.string().describe('Short name/slug for the document, e.g. "product-spec"'),
      content: z.string().optional().describe('Optional initial markdown content. Defaults to a titled stub.'),
    },
  },
  async ({ name, content }) => {
    const doc = slug(name);
    if (!doc) return fail('Provide a valid document name.');
    if (await docExists(doc)) return fail(`Document "${doc}" already exists.`);
    const body = content && content.trim() ? content : `# ${name.trim()}\n\nCreated by an AI agent via MCP. Humans and agents edit this together.\n`;
    try {
      await withDoc(doc, {
        mutate: true,
        fn: (ytext) => {
          if (ytext.length === 0) ytext.insert(0, body);
        },
      });
      return ok(`Created document "${doc}". It now appears in easymd for everyone.`);
    } catch (e) {
      return fail(e.message);
    }
  },
);

server.registerTool(
  'update_document',
  {
    title: 'Update document (replace)',
    description: 'Replace the entire markdown content of a document. Changes sync live to anyone with it open.',
    inputSchema: {
      name: z.string().describe('Document name'),
      content: z.string().describe('New full markdown content'),
    },
  },
  async ({ name, content }) => {
    const doc = slug(name);
    if (supabase && !(await docExists(doc))) return fail(`Document "${doc}" does not exist.`);
    try {
      await withDoc(doc, {
        mutate: true,
        fn: (ytext) => {
          ytext.delete(0, ytext.length);
          ytext.insert(0, content);
        },
      });
      return ok(`Updated "${doc}" (${content.length} chars). Live editors saw the change instantly.`);
    } catch (e) {
      return fail(e.message);
    }
  },
);

server.registerTool(
  'append_to_document',
  {
    title: 'Append to document',
    description: 'Append markdown to the end of a document without touching existing content. Syncs live.',
    inputSchema: {
      name: z.string().describe('Document name'),
      text: z.string().describe('Markdown to append'),
    },
  },
  async ({ name, text }) => {
    const doc = slug(name);
    if (supabase && !(await docExists(doc))) return fail(`Document "${doc}" does not exist.`);
    try {
      const total = await withDoc(doc, {
        mutate: true,
        fn: (ytext) => {
          const prefix = ytext.length && !ytext.toString().endsWith('\n') ? '\n' : '';
          ytext.insert(ytext.length, prefix + text);
          return ytext.length;
        },
      });
      return ok(`Appended ${text.length} chars to "${doc}" (now ${total} chars).`);
    } catch (e) {
      return fail(e.message);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`easymd MCP server ready. Collab: ${WS_URL} | Supabase: ${supabase ? 'configured' : 'not configured'}`);
