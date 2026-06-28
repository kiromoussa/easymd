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
