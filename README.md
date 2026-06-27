# easymd

**Google Docs for markdown — except the file on disk stays canonical.**

Collaborate on `CLAUDE.md`, `AGENTS.md`, or any `.md` file in real time. The document on screen is the actual file in your repo. No import/export round-trip, no copy-paste tax.

```bash
npm install
npm run build
easymd open CLAUDE.md
```

Share the URL with a teammate. Edits sync live via CRDT. Changes land straight back to the file on disk and into git.

## Why

AI agents made markdown load-bearing. `AGENTS.md` and `CLAUDE.md` are now the single source of truth for how your project works — but collaborating on them still means pull requests for engineers or copy-paste between Google Docs and your repo for everyone else.

easymd fixes the one painful shared file:

- **Canonical file stays canonical** — edit the real `.md` on disk, not a hosted copy
- **Real-time multiplayer** — live cursors, presence, CRDT conflict resolution
- **CLI keeps it honest** — `easymd open path/to/file.md` from your terminal
- **Agents stay in the loop** — the same file humans edit is what agents read and write

## MVP scope (v0.1)

This is the narrowest version to validate the wedge:

| Shipped | Not yet |
|---------|---------|
| `easymd open <file>` CLI | Suggestion / track-changes mode |
| Real-time co-editing (Yjs) | Comment threads |
| Two-way filesystem sync | Full edit history UI |
| Edit / Split / Preview toggle | Remote/cloud hosting |
| Live presence avatars | SSO / team billing |

## How it works

```
┌─────────────┐     WebSocket (Yjs)     ┌─────────────┐
│  Browser A  │◄───────────────────────►│             │
└─────────────┘                         │  easymd     │
┌─────────────┐                         │  server     │◄──► CLAUDE.md (disk)
│  Browser B  │◄───────────────────────►│             │
└─────────────┘                         └─────────────┘
       ▲                                        ▲
       │                                        │
  easymd open                            git / agents / vim
```

1. `easymd open` starts a local server bound to one file
2. The server loads the file into a Yjs CRDT document
3. Browsers connect and edit via CodeMirror 6 + `y-codemirror`
4. Editor changes debounce-write back to disk
5. External changes (git pull, agent writes, manual edits) are picked up via filesystem watch and merged into the live session

## Usage

```bash
# Open a file (creates it if missing)
easymd open CLAUDE.md

# Fixed port for sharing on your LAN
easymd open AGENTS.md --port 3847
```

The CLI prints a local URL. Anyone who can reach your machine on that port can join the session.

## Development

```bash
npm install
npm run build    # bundle client → dist/client.js
node bin/easymd.js open CLAUDE.md
```

## Project structure

```
bin/easymd.js       CLI entry point
src/server.js       HTTP + WebSocket server
src/file-sync.js    Disk ↔ Yjs sync
client/             Browser editor UI
dist/               Built client bundle
```

## License

MIT
