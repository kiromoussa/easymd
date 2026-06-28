-- Cross-account document sharing. A row grants a non-owner account access to a doc.
-- The owner is still encoded in documents.owner_id / the room name; this table adds
-- additional users who may open and (by default) edit a specific document.
create table if not exists public.document_acl (
  doc_name   text not null,
  user_id    text not null,
  role       text not null default 'editor',   -- 'editor' | 'viewer'
  invited_by text,
  created_at timestamptz not null default now(),
  primary key (doc_name, user_id)
);

create index if not exists document_acl_user_idx on public.document_acl (user_id);

alter table public.document_acl enable row level security;
grant select, insert, update, delete on public.document_acl to service_role;
revoke all on public.document_acl from anon, authenticated;

comment on table public.document_acl is 'Cross-account access grants for easymd documents (server-only via service role).';
