import http from 'http';
import { WebSocketServer } from 'ws';
import * as Y from 'yjs';
import { getYDoc, setupWSConnection } from 'y-websocket/bin/utils';

const PORT = Number(process.env.COLLAB_PORT || 3848);
const DOC_NAME = 'easymd-demo';

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

> The canonical file stays in your repo. This demo runs in-memory; \`easymd open CLAUDE.md\` writes straight to disk.
`;

const ydoc = getYDoc(DOC_NAME, false);
const ytext = ydoc.getText('markdown');

if (ytext.length === 0) {
  ytext.insert(0, DEMO_CONTENT);
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
