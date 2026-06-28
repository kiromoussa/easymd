// easymd MCP server (bundled in the CLI).
//
// Unlike the server-side MCP, this one is safe to run on any machine: it carries NO
// server secrets. It authenticates as YOU using the CLI token saved at `easymd login`
// (~/.easymd/credentials.json) and talks to the easymd web app's token-authed API.
// So any agent (Claude, Cursor, …) can read/create/edit the same live documents you do.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getCredentials } from './config.js';

const creds = await getCredentials();
const BASE = (creds?.url || process.env.EASYMD_URL || 'http://localhost:3000').replace(/\/$/, '');
const TOKEN = creds?.token || '';

const ok = (text) => ({ content: [{ type: 'text', text }] });
const fail = (text) => ({ content: [{ type: 'text', text }], isError: true });
const stripOwner = (name) => (name.includes('__') ? name.split('__').slice(1).join('__') : name);

async function api(path, opts = {}) {
  if (!TOKEN) throw new Error('Not logged in. Run `easymd login` first.');
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}`, ...(opts.headers || {}) },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

const server = new McpServer({ name: 'easymd', version: '0.1.1' });

server.registerTool(
  'list_documents',
  {
    title: 'List documents',
    description: 'List all of your easymd documents (name, title, last updated). These are the live docs you edit in the browser.',
    inputSchema: {},
  },
  async () => {
    try {
      const { documents = [] } = await api('/api/cli/documents');
      if (!documents.length) return ok('No documents yet. Use create_document to add one.');
      return ok(documents.map((d) => `- ${stripOwner(d.name)}${d.title ? ` — ${d.title}` : ''} (updated ${d.updated_at})`).join('\n'));
    } catch (e) {
      return fail(e.message);
    }
  },
);

server.registerTool(
  'read_document',
  {
    title: 'Read document',
    description: 'Return the current markdown content of one of your documents by name.',
    inputSchema: { name: z.string().describe('Document name, e.g. "product-spec"') },
  },
  async ({ name }) => {
    try {
      const { content } = await api(`/api/cli/documents?name=${encodeURIComponent(name)}`);
      return ok(content || '(empty document)');
    } catch (e) {
      return fail(e.message);
    }
  },
);

server.registerTool(
  'create_document',
  {
    title: 'Create document',
    description: 'Create a new document in your account. It appears live in the editor and in your dashboard.',
    inputSchema: {
      name: z.string().describe('Short name/slug, e.g. "product-spec"'),
      content: z.string().optional().describe('Optional initial markdown content'),
    },
  },
  async ({ name, content }) => {
    try {
      const body = content && content.trim() ? content : `# ${name}\n\nCreated by an AI agent via MCP.\n`;
      await api('/api/cli/documents', { method: 'POST', body: JSON.stringify({ name, title: name, content: body }) });
      return ok(`Created "${name}". It now appears in your easymd dashboard and live editor.`);
    } catch (e) {
      return fail(e.message);
    }
  },
);

server.registerTool(
  'update_document',
  {
    title: 'Update document (replace)',
    description: 'Replace the entire markdown content of a document. Syncs live to anyone with it open.',
    inputSchema: { name: z.string(), content: z.string().describe('New full markdown content') },
  },
  async ({ name, content }) => {
    try {
      await api('/api/cli/documents', { method: 'POST', body: JSON.stringify({ name, content }) });
      return ok(`Updated "${name}" (${content.length} chars). Live editors saw it instantly.`);
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
    inputSchema: { name: z.string(), text: z.string().describe('Markdown to append') },
  },
  async ({ name, text }) => {
    try {
      const { bytes } = await api('/api/cli/documents', { method: 'POST', body: JSON.stringify({ name, op: 'append', text }) });
      return ok(`Appended ${text.length} chars to "${name}" (now ${bytes} chars).`);
    } catch (e) {
      return fail(e.message);
    }
  },
);

server.registerTool(
  'update_task_state',
  {
    title: 'Update task state',
    description:
      'Update the document\'s "Task State" block — the shared execution-handoff surface between humans and agents. Only the fields you pass change; the rest are preserved. Use this to keep the doc reflecting the current goal, decisions, open questions, failed approaches, the last command you validated (with its result), and the next concrete action. Updates appear live in the open editor.',
    inputSchema: {
      name: z.string().describe('Document name'),
      goal: z.string().optional().describe('Current goal / what we are trying to achieve'),
      decisions: z.string().optional().describe('Decisions made so far'),
      openQuestions: z.string().optional().describe('Unresolved questions'),
      failedApproaches: z.string().optional().describe('Approaches tried that did not work'),
      lastValidated: z.string().optional().describe('Last command you ran to validate, and its result (e.g. "`npm test` → 18 passing, 2 failing")'),
      nextAction: z.string().optional().describe('The next concrete action'),
    },
  },
  async ({ name, ...fields }) => {
    try {
      const state = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined && v !== ''));
      if (!Object.keys(state).length) return fail('Provide at least one field to update.');
      await api('/api/cli/documents', { method: 'POST', body: JSON.stringify({ name, op: 'task', state }) });
      return ok(`Updated Task State for "${name}" (${Object.keys(state).join(', ')}).`);
    } catch (e) {
      return fail(e.message);
    }
  },
);

server.registerTool(
  'propose_change',
  {
    title: 'Propose a change (intent before edit)',
    description:
      'Propose an edit to a document WITHOUT overwriting it. State your intent (e.g. "resolve contradiction in §Auth", "add acceptance criteria", "update status") and the proposed markdown. It appears in the doc as a reviewable proposal the human can Accept or Reject — collaboration becomes intentful, not a silent overwrite. Use this for substantive changes; use update_document only for direct edits the human expects.',
    inputSchema: {
      name: z.string().describe('Document name'),
      intent: z.string().describe('What this change does and why (shown to the human)'),
      content: z.string().describe('The proposed markdown'),
    },
  },
  async ({ name, intent, content }) => {
    try {
      await api('/api/cli/documents', { method: 'POST', body: JSON.stringify({ name, op: 'propose', intent, content }) });
      return ok(`Proposed “${intent}” on "${name}". The owner can Accept or Reject it in the editor.`);
    } catch (e) {
      return fail(e.message);
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`easymd MCP ready → ${BASE} ${TOKEN ? '(authenticated)' : '(NOT logged in — run `easymd login`)'}`);
