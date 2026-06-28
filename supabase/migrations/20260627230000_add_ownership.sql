-- Per-account ownership for easymd documents.
--
-- The document `name` (primary key + Yjs room name) is now namespaced as
-- "<owner_id>__<slug>", so two accounts can each have a doc called "spec" without
-- colliding. `owner_id` is stored explicitly as well so the dashboard / API can
-- filter by account with a simple indexed lookup, and `title` holds the friendly
-- display name (the room id itself stays URL/slug-safe).
--
-- Legacy rows created before this migration have a null owner_id and are simply
-- not shown to any account (they remain reachable only by their exact room name).

alter table public.documents add column if not exists owner_id text;
alter table public.documents add column if not exists title text;

create index if not exists documents_owner_id_idx on public.documents (owner_id);

comment on column public.documents.owner_id is 'Clerk user id that owns this document. Null = legacy/global doc.';
comment on column public.documents.title is 'Human-friendly display title. The name column stays the slugged room id ("<owner_id>__<slug>").';
