import 'server-only';
import { Liveblocks } from '@liveblocks/node';
import * as Y from 'yjs';

export const liveblocks = new Liveblocks({ secret: process.env.LIVEBLOCKS_SECRET_KEY! });

// Yjs text key — must match the editor (Editor uses getText('codemirror')).
const TEXT_KEY = 'codemirror';

// Create the room if it doesn't exist, granting the owner write access.
// Returns true if the room was newly created (so callers can seed initial content).
export async function ensureRoom(roomId: string, ownerId: string): Promise<boolean> {
  try {
    await liveblocks.createRoom(roomId, {
      defaultAccesses: [],
      usersAccesses: { [ownerId]: ['room:write'] },
    });
    return true;
  } catch {
    // Already exists — make sure the owner still has access.
    try {
      await liveblocks.updateRoom(roomId, { usersAccesses: { [ownerId]: ['room:write'] } });
    } catch {
      /* ignore */
    }
    return false;
  }
}

// Welcome content seeded into each account's starter doc.
export const WELCOME_MD = `# Welcome to easymd

You're editing real markdown — the same format your agents read.

## Why teams switch from Docs → .md

Converting heavy formats to clean Markdown cuts token usage dramatically.

## Agents are first-class

An MCP server can read, create, and edit these same documents. Changes an agent makes
appear here live, and edits humans make are visible to the agent — one shared file.
`;

// Grant (or revoke with null) a collaborator's access to a room.
export async function setRoomAccess(roomId: string, userId: string, write: boolean) {
  await liveblocks.updateRoom(roomId, {
    usersAccesses: { [userId]: write ? ['room:write'] : null },
  });
}

// Read the room's markdown content.
export async function readRoomText(roomId: string): Promise<string> {
  try {
    const buf = await liveblocks.getYjsDocumentAsBinaryUpdate(roomId);
    const doc = new Y.Doc();
    Y.applyUpdate(doc, new Uint8Array(buf));
    return doc.getText(TEXT_KEY).toString();
  } catch {
    return '';
  }
}

// Apply a mutation to the room's Yjs doc and push only the diff to Liveblocks.
async function mutateRoom<T>(roomId: string, fn: (t: Y.Text) => T): Promise<T> {
  const doc = new Y.Doc();
  try {
    const buf = await liveblocks.getYjsDocumentAsBinaryUpdate(roomId);
    Y.applyUpdate(doc, new Uint8Array(buf));
  } catch {
    /* empty/new room */
  }
  const before = Y.encodeStateVector(doc);
  const ytext = doc.getText(TEXT_KEY);
  let result!: T;
  doc.transact(() => {
    result = fn(ytext);
  });
  const update = Y.encodeStateAsUpdate(doc, before);
  await liveblocks.sendYjsBinaryUpdate(roomId, update);
  return result;
}

export const replaceRoomText = (roomId: string, content: string) =>
  mutateRoom(roomId, (t) => {
    t.delete(0, t.length);
    t.insert(0, content);
    return t.length;
  });

export const appendRoomText = (roomId: string, text: string) =>
  mutateRoom(roomId, (t) => {
    const prefix = t.length && !t.toString().endsWith('\n') ? '\n' : '';
    t.insert(t.length, prefix + text);
    return t.length;
  });

// ── Task State block: the human/agent execution-handoff surface ───────────────────
// Lives between stable HTML-comment fences so agents have a reliable anchor and humans
// never write YAML. Fields are merged (only provided ones change).
export type TaskState = Partial<{
  goal: string;
  decisions: string;
  openQuestions: string;
  failedApproaches: string;
  lastValidated: string;
  nextAction: string;
}>;

const TASK_OPEN = '<!-- easymd:task -->';
const TASK_CLOSE = '<!-- /easymd:task -->';
const TASK_FIELDS: [keyof TaskState, string][] = [
  ['goal', 'Goal'],
  ['decisions', 'Decisions'],
  ['openQuestions', 'Open questions'],
  ['failedApproaches', 'Failed approaches'],
  ['lastValidated', 'Last validated'],
  ['nextAction', 'Next action'],
];

function renderTaskBlock(s: TaskState): string {
  const lines = [TASK_OPEN, '## 📍 Task State'];
  for (const [key, label] of TASK_FIELDS) lines.push(`- **${label}:** ${s[key]?.trim() || '—'}`);
  lines.push(TASK_CLOSE);
  return lines.join('\n');
}

function parseTaskBlock(region: string): TaskState {
  const out: TaskState = {};
  for (const [key, label] of TASK_FIELDS) {
    const m = new RegExp(`-\\s*\\*\\*${label}:\\*\\*\\s*(.*)`).exec(region);
    if (m) {
      const v = m[1].trim();
      if (v && v !== '—') out[key] = v;
    }
  }
  return out;
}

// ── Provenance log + intent-based proposals ───────────────────────────────────────
const LOG_OPEN = '<!-- easymd:log -->';
const LOG_CLOSE = '<!-- /easymd:log -->';
const escapeAttr = (s: string) => s.replace(/[\r\n]+/g, ' ').replace(/"/g, '”').replace(/--?>/g, '→').slice(0, 200);

// Append a provenance entry to the doc's Activity log (created if missing).
export async function appendLog(roomId: string, entry: string) {
  await mutateRoom(roomId, (t) => {
    const text = t.toString();
    const line = `- ${entry}\n`;
    const start = text.indexOf(LOG_OPEN);
    if (start !== -1) {
      const closeIdx = text.indexOf(LOG_CLOSE, start);
      if (closeIdx !== -1) {
        t.insert(closeIdx, line);
        return;
      }
    }
    t.insert(t.length, `${t.length && !text.endsWith('\n') ? '\n' : ''}\n${LOG_OPEN}\n## 🧾 Activity\n${line}${LOG_CLOSE}\n`);
  });
}

// Insert an intent-tagged proposal block (a reviewable suggestion, not an overwrite)
// and log it. Returns the proposal id.
export async function addProposal(roomId: string, intent: string, content: string, by = 'agent'): Promise<string> {
  const id = `p${Math.abs(hashStr(intent + content)).toString(36)}${(content.length % 997).toString(36)}`;
  const block = `<!-- easymd:proposal id="${id}" intent="${escapeAttr(intent)}" by="${by}" -->\n${content}\n<!-- /easymd:proposal -->`;
  await mutateRoom(roomId, (t) => {
    t.insert(0, `${block}\n\n`);
  });
  await appendLog(roomId, `${by} proposed: ${intent}`);
  return id;
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

// Raise a conflict/staleness flag when the agent's repo understanding diverges from
// the spec. Renders as an inline callout in the doc; logged for provenance.
const FLAG_LABELS: Record<string, { label: string; icon: string }> = {
  'conflicts-with-code': { label: 'Conflicts with code', icon: '🛑' },
  'stale-assumption': { label: 'Stale assumption', icon: '⚠️' },
  'needs-review': { label: 'Needs review', icon: '🔶' },
};

export async function addFlag(roomId: string, kind: string, note: string, by = 'agent'): Promise<string> {
  const k = FLAG_LABELS[kind] ? kind : 'needs-review';
  const { label, icon } = FLAG_LABELS[k];
  const oneLine = note.replace(/[\r\n]+/g, ' ').trim();
  const id = `f${Math.abs(hashStr(k + oneLine)).toString(36)}`;
  const block = `<!-- easymd:flag id="${id}" kind="${k}" -->\n> ${icon} **${label}** — ${oneLine || 'see note'}\n<!-- /easymd:flag -->`;
  await mutateRoom(roomId, (t) => {
    const text = t.toString();
    // Place after the Task State block if present, else at the top.
    const taskEnd = text.indexOf(TASK_CLOSE);
    const at = taskEnd !== -1 ? taskEnd + TASK_CLOSE.length : 0;
    t.insert(at, `${at === 0 ? '' : '\n\n'}${block}${at === 0 ? '\n\n' : ''}`);
  });
  await appendLog(roomId, `${by} flagged: ${label}${oneLine ? ` — ${oneLine}` : ''}`);
  return id;
}

// Create/merge the Task State block in a room via a minimal Yjs splice (preserves
// concurrent edits outside the block). Returns the merged state.
export async function upsertTaskState(roomId: string, partial: TaskState): Promise<TaskState> {
  return mutateRoom(roomId, (t) => {
    const text = t.toString();
    const start = text.indexOf(TASK_OPEN);
    let existing: TaskState = {};
    let regionLen = 0;
    if (start !== -1) {
      const endIdx = text.indexOf(TASK_CLOSE, start);
      regionLen = endIdx !== -1 ? endIdx + TASK_CLOSE.length - start : t.length - start;
      existing = parseTaskBlock(text.slice(start, start + regionLen));
    }
    const merged: TaskState = { ...existing, ...partial };
    const block = renderTaskBlock(merged);
    if (start !== -1) {
      t.delete(start, regionLen);
      t.insert(start, block);
    } else {
      t.insert(0, `${block}\n\n`);
    }
    return merged;
  });
}
