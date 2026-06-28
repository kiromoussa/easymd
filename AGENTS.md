# AGENTS.md

Project guidance for agents working in this repository. See `README.md` and `CLAUDE.md` for product overview.

## Cursor Cloud specific instructions

This repo contains two independently-runnable products:

- **CLI (`easymd`)** — root package. Self-contained collaborative markdown editor (Express + WebSocket + Yjs CRDT) that syncs a `.md` file on disk to/from a browser editor. No external services or secrets required.
- **Web app (`web/`)** — Next.js 16 (Turbopack) landing page + Clerk auth + a Clerk-protected `/demo` that talks to a standalone WebSocket collab server.

Dependencies for both packages are installed by the startup update script (root `npm install`, which auto-runs `scripts/build.js` via `postinstall` to bundle the CLI client into `dist/`, plus `npm install` in `web/`).

### Running the CLI
- Run with `node bin/easymd.js open <file.md> [--port N]` (or `npm start -- open <file.md>`). Default port is random; pass `--port` for a fixed one.
- The server binds to `127.0.0.1`. It opens a browser via the `open` package on launch — harmless/no-op in headless environments.
- Edits in the browser sync to disk (debounced ~250ms); external file changes (git, agents) flow back into the editor via a `chokidar` watcher. This two-way disk sync is the core feature.

### Running the web app
- `npm run dev` (in `web/`) runs the Next.js dev server (port 3000) and the collab WebSocket server (port 3848) together via `concurrently`. The harmless log `Yjs was already imported` comes from the collab server and can be ignored.
- **Requires valid Clerk keys.** `web/src/proxy.ts` runs `clerkMiddleware` on every request, so it validates `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` even for public routes (`/`, `/api/health`). With missing/placeholder keys, *every* route returns HTTP 500 `Publishable key not valid.` — the landing page will not render.
- Set up env once with `cp web/.env.example web/.env.local` and fill in real keys from dashboard.clerk.com (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`). `web/.env.local` is gitignored. The `/demo` route additionally requires being signed in (Clerk test instances allow self sign-up with test emails, e.g. `you+clerk_test@example.com` with verification code `424242`).
- **Local testing without Clerk keys:** leave the two Clerk key vars unset/empty (do NOT use the `pk_test_...` placeholder — a malformed key 500s every route). With no keys, Clerk runs in **keyless dev mode** and the app renders + allows sign-up, which is enough to reach `/demo`. Keyless mode is dev-only.

### Theming (dark/light mode)
- Class-based dark mode: `globals.css` declares `@custom-variant dark (&:where(.dark, .dark *))`; `layout.tsx` has an inline no-flash script that adds `.dark` to `<html>` from `localStorage('theme')` / system preference; `components/theme-toggle.tsx` toggles it. Use standard `dark:` utilities in components.
- Gotcha: prefer explicit `dark:` variant utilities (e.g. `bg-white dark:bg-[#161b22]`) over `bg-[var(--token)]` for themed surfaces. Under Turbopack dev, plain `bg-[var(--token)]` utilities that rely on CSS-var inheritance themed inconsistently across sibling panes; `dark:` variants (and raw `.dark .selector {}` rules in `globals.css`, used for the CodeMirror editor + `.markdown-preview`) are reliable.
- After adding brand-new arbitrary utility classes, a Next/Turbopack dev restart (`rm -rf .next`) may be needed for Tailwind to generate them; stale HMR can make new files render unstyled.

### Supabase persistence (collab documents)
The web collab server (`web/scripts/collab-server.mjs`) persists the Yjs document to **Supabase** (via `@supabase/supabase-js`) so edits survive restarts. It is **env-driven**: with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` set it loads/seeds the doc from `public.documents` and debounce-saves on every edit; unset → in-memory fallback (logs a warning). State is stored **base64-encoded** in a `text` column. The server uses the **service-role key** (never sent to the browser), which bypasses RLS; `public.documents` has RLS enabled with **no** anon/authenticated grants/policies, so document state is never reachable via the public Data API. Schema lives in `supabase/migrations/`.

The collab server is a standalone `node` process (not Next.js), so it loads `web/.env.local` itself via `process.loadEnvFile`, and otherwise reads the ambient environment (injected secrets). Look for `Persistence: Supabase (durable) → <url>` / `Loaded "easymd-demo" from Supabase (...)` on startup to confirm wiring.

- **Production / hosted Supabase:** set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Dashboard → Project Settings → API). The `documents` table must exist there — apply the migration in `supabase/migrations/` via the Supabase SQL Editor or `supabase db push` (needs the DB password / access token). Gotcha: the service role needs a table GRANT (the migration includes `grant ... to service_role`); without it you get `permission denied for table documents`.
- **Local dev:** requires Docker + the Supabase CLI (system tools — install once; not part of the npm update script). From repo root: `supabase start`, then `supabase db reset --local` (or `migration up --local`) to apply schema. Use the local API URL (`http://127.0.0.1:54321`) + the local `service_role` key from `supabase status -o env`. Studio: http://127.0.0.1:54323. For Docker-in-Docker here: install Docker 29 with `fuse-overlayfs` storage driver + `containerd-snapshotter: false`, iptables-legacy, run `dockerd`, and `chmod 666 /var/run/docker.sock`.
- Inspect state quickly: `docker exec supabase_db_workspace psql -U postgres -d postgres -c "select name, length(state), updated_at from public.documents;"`.

### AI agent integration (MCP)
The collab server is **multi-document**: any WebSocket room name is loaded from / saved to the `documents` table (room = WS URL path). The editor has a document switcher (top-bar chip) backed by `GET/POST /api/documents`.

`web/scripts/mcp-server.mjs` (run: `npm run mcp` in `web/`) is an MCP **stdio** server exposing `list_documents`, `read_document`, `create_document`, `update_document`, `append_to_document`. It connects to the collab server as a Yjs client, so agent edits sync **live** to open browser editors and persist to Supabase; new docs appear in the switcher for everyone. Requires the collab server running + Supabase creds. Example config: `.cursor/mcp.json` (creds resolve from `web/.env.local`; note `process.loadEnvFile` does NOT override values already set in the MCP client's `env`, so leave Supabase keys out of `mcp.json` to use `.env.local`).

- **Yjs instance pairing (critical):** the collab server imports `y-websocket/bin/utils` (CJS) so it pairs Yjs via `require('yjs')`; the MCP server imports `y-websocket` (ESM) so it must use `import * as Y from 'yjs'`. Mixing the CJS and ESM Yjs builds triggers `Yjs was already imported` and silently breaks CRDT sync (reads return empty / edits drop).

### Lint / build
- Web lint: `npm run lint` in `web/` (flat ESLint config). The repo currently has pre-existing lint errors in `web/src/components/site-header.tsx` (`no-html-link-for-pages`) unrelated to environment setup.
- Web production build: `npm run build` in `web/` (also requires Clerk keys to be present).
- The CLI has no lint/test scripts; `npm run build` at the root only bundles the browser client.
