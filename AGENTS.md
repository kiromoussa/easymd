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
- Set up env once with `cp web/.env.example web/.env.local` and fill in real keys from dashboard.clerk.com (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`). `web/.env.local` is gitignored. The `/demo` route additionally requires being signed in (Clerk test instances allow self sign-up with test emails).

### Supabase persistence (collab documents)
The web collab server (`web/scripts/collab-server.mjs`) persists the Yjs document to **Supabase Postgres** so edits survive restarts. It is **env-driven**: with `COLLAB_DATABASE_URL` set it loads/seeds the doc from the `public.documents` table and debounce-saves on every edit; with the var unset it falls back to in-memory (logs a warning). The collab server connects with a privileged DB role (bypasses RLS); `public.documents` has RLS enabled with **no** policies so the binary state is never exposed via the Data API. Schema lives in `supabase/migrations/`.

The collab server is a standalone `node` process (not Next.js), so it loads `web/.env.local` itself via `process.loadEnvFile`. Look for `Persistence: Supabase Postgres (durable)` / `Loaded "easymd-demo" from Supabase (...)` on startup to confirm it's wired up.

- **Local dev:** requires Docker + the Supabase CLI (system tools — install once; not part of the npm update script). Then from repo root: `supabase start` (local stack), `supabase migration up --local` (apply schema). Local DB URL is `postgresql://postgres:postgres@127.0.0.1:54322/postgres` (already in `web/.env.example`). Studio: http://127.0.0.1:54323. For Docker-in-Docker here, install Docker 29 with the `fuse-overlayfs` storage driver + `containerd-snapshotter: false`, use iptables-legacy, run `dockerd`, and `chmod 666 /var/run/docker.sock`.
- **Production:** set `COLLAB_DATABASE_URL` to your hosted Supabase connection string (Dashboard → Settings → Database → Connection string) with `?sslmode=require`, and apply migrations with `supabase db push`.
- Inspect state quickly: `docker exec supabase_db_<project> psql -U postgres -d postgres -c "select name, octet_length(state), updated_at from public.documents;"` (container name is `supabase_db_workspace` here).

### Lint / build
- Web lint: `npm run lint` in `web/` (flat ESLint config). The repo currently has pre-existing lint errors in `web/src/components/site-header.tsx` (`no-html-link-for-pages`) unrelated to environment setup.
- Web production build: `npm run build` in `web/` (also requires Clerk keys to be present).
- The CLI has no lint/test scripts; `npm run build` at the root only bundles the browser client.
