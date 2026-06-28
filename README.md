# easymd

**Google Docs for markdown — except the file on disk stays canonical.**

Collaborate on `CLAUDE.md`, `AGENTS.md`, or any `.md` file in real time. The document on screen is the actual file in your repo. No import/export round-trip, no copy-paste tax.

## Web app (landing + demo)

Professional landing page with **token savings** messaging, **Clerk auth** for signups, and a **protected live demo** at `/demo`.

```bash
cd web
cp .env.example .env.local   # add Clerk keys from dashboard.clerk.com
npm install
npm run dev                  # Next.js + collab WebSocket server
```

Open [http://localhost:3000](http://localhost:3000) → Sign up → Live collaborative editor.

### Token savings (why markdown for AI)

Converting PDFs, Word/DOCX, or HTML to clean `.md` cuts token usage dramatically:

| Format | Typical savings |
|--------|-----------------|
| Raw HTML | 75–90% |
| Word / DOCX | 50–70% |
| Text-based PDF | 40–65% |

Markdown strips hidden formatting metadata while keeping structure agents need — then reference `@CLAUDE.md` on demand instead of pasting every prompt.

## CLI (local file editing)

```bash
npm install
npm run build
easymd open CLAUDE.md
```

Share the URL with a teammate. Edits sync live via CRDT. Changes land straight back to the file on disk and into git.

## CLI auto-sync (push every .md into your account)

Sign in once, then have every markdown file in your repo sync into your easymd account
automatically — so anything you or an AI agent writes to disk shows up in the dashboard
and is editable live.

```bash
npx easymd-cli login          # opens your browser, sign in with Clerk, authorize this machine
npx easymd-cli auto on        # background watcher: every new/changed .md syncs to your account
npx easymd-cli auto status    # check it's running
npx easymd-cli auto off       # stop it
```

Other commands:

```bash
easymd sync ./docs        # one-shot push of all .md under a folder
easymd watch .            # foreground watcher (what `auto on` runs detached)
easymd whoami             # show the logged-in account
easymd logout             # remove credentials + stop auto-sync
```

Credentials live in `~/.easymd/credentials.json` (a long-lived token bound to your Clerk
user id — secrets stay on the server). Point the CLI at a self-hosted/production instance
with `EASYMD_URL=https://your-easymd.example.com`.

## AI agents (MCP)

easymd ships an MCP server so AI agents edit the **same live documents** humans do — changes sync in real time and persist to Supabase.

The easiest way is the CLI's bundled MCP server. It authenticates with your `easymd login` token (no API keys to paste) and works with any agent:

```bash
npm i -g easymd-cli
easymd login
easymd mcp-install        # registers it with Cursor + Claude Desktop
# Claude Code:  claude mcp add easymd -- easymd mcp
```

Or use [`add-mcp`](https://github.com/neondatabase-labs/add-mcp) to register it across **all** detected agents (Cursor, Claude Desktop, VS Code, …) in one command:

```bash
npx add-mcp@latest --command easymd --args "mcp" --name easymd
```

Tools: `list_documents`, `read_document`, `create_document`, `update_document`, `append_to_document`. Docs an agent creates show up in your dashboard; edits an agent makes appear live in any open editor.

(The repo also has a server-side MCP at `web/scripts/mcp-server.mjs` — `npm run mcp` — which uses the service-role key directly; prefer the CLI version for end users.)

## Why

AI agents made markdown load-bearing. `AGENTS.md` and `CLAUDE.md` are now the single source of truth for how your project works — but collaborating on them still means pull requests for engineers or copy-paste between Google Docs and your repo for everyone else.

easymd fixes the one painful shared file:

- **Canonical file stays canonical** — edit the real `.md` on disk, not a hosted copy
- **Real-time multiplayer** — live cursors, presence, CRDT conflict resolution
- **CLI keeps it honest** — `easymd open path/to/file.md` from your terminal
- **Agents stay in the loop** — the same file humans edit is what agents read and write
- **Token-efficient by design** — lightweight `.md` beats bloated DOCX/HTML/PDF for agent context

## Project structure

```
web/                Next.js landing, Clerk auth, protected demo
bin/easymd.js       CLI entry point
src/server.js       Local HTTP + WebSocket server
src/file-sync.js    Disk ↔ Yjs sync
client/             CLI browser editor UI
```

## Clerk setup

1. Create an app at [dashboard.clerk.com](https://dashboard.clerk.com)
2. Copy keys into `web/.env.local` (see `web/.env.example`)
3. Enable Email + Google sign-in (recommended)
4. Set redirect URLs: after sign-in/sign-up → `/demo`

## License

MIT
