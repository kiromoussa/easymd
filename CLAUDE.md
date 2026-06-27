# CLAUDE.md

Project context for AI coding agents working in this repository.

## What this project is

**easymd** is collaborative markdown editing where the file on disk stays canonical.
Run `easymd open CLAUDE.md` to edit this file in the browser with teammates — changes land straight back here.

## Architecture

- `bin/easymd.js` — CLI entry (`easymd open <file>`)
- `src/server.js` — local HTTP + WebSocket server
- `src/file-sync.js` — two-way sync between Yjs doc and filesystem
- `client/` — browser editor (CodeMirror 6 + Yjs CRDT)

## Conventions

- Node.js 18+, ESM throughout
- Keep the MVP narrow: one file, real-time co-editing, disk sync
- Do not introduce hosted copies of documents — disk is always canonical

## Commands

```bash
npm install
npm run build
npx easymd open CLAUDE.md
```