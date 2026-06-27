-- Persistence for easymd collaborative documents.
-- Each row stores the encoded Yjs document state (Y.encodeStateAsUpdate, base64) for
-- one collaborative document, keyed by its document name (the WebSocket room name).
--
-- Access model: only the collaborative WebSocket server touches this table, and it
-- uses the Supabase service-role key, which bypasses RLS. RLS is enabled with NO
-- policies so the document state is never reachable through the public Data API
-- (PostgREST via the anon/authenticated roles).

create table if not exists public.documents (
  name       text primary key,
  state      text not null,
  updated_at timestamptz not null default now()
);

alter table public.documents enable row level security;

-- Server-only access: the collab server uses the service_role key (bypasses RLS but
-- still needs a table GRANT). No grants/policies for anon/authenticated, so the
-- document state is never reachable through the public Data API.
grant select, insert, update, delete on public.documents to service_role;
revoke all on public.documents from anon, authenticated;

comment on table public.documents is 'Encoded Yjs CRDT state for easymd collaborative documents (server-only access via service role).';
comment on column public.documents.name is 'Document/room name (e.g. easymd-demo or a file path).';
comment on column public.documents.state is 'Base64-encoded Yjs document state from Y.encodeStateAsUpdate.';
