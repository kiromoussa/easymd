-- Persistence for easymd collaborative documents.
-- Each row stores the encoded Yjs document state (Y.encodeStateAsUpdate) for one
-- collaborative document, keyed by its document name (the WebSocket room name).
--
-- Access model: only the collaborative WebSocket server touches this table, and it
-- connects with a privileged Postgres role (local: `postgres`; hosted Supabase: the
-- database connection string), which bypasses RLS. RLS is enabled with NO policies so
-- the binary document state is never reachable through the public Data API (PostgREST
-- via the anon/authenticated roles).

create table if not exists public.documents (
  name       text primary key,
  state      bytea not null,
  updated_at timestamptz not null default now()
);

alter table public.documents enable row level security;

comment on table public.documents is 'Encoded Yjs CRDT state for easymd collaborative documents (server-only access).';
comment on column public.documents.name is 'Document/room name (e.g. easymd-demo or a file path).';
comment on column public.documents.state is 'Binary Yjs document state from Y.encodeStateAsUpdate.';
