-- Link sharing: a document-level access level for "anyone with the link" (signed in).
alter table public.documents add column if not exists link_access text not null default 'none';
-- 'none' | 'view' | 'edit'

-- Pending invites: an email invited before it maps to an easymd account. Claimed into
-- document_acl when that person signs in.
create table if not exists public.document_invites (
  doc_name   text not null,
  email      text not null,
  role       text not null default 'editor',
  invited_by text,
  created_at timestamptz not null default now(),
  primary key (doc_name, email)
);
create index if not exists document_invites_email_idx on public.document_invites (email);
alter table public.document_invites enable row level security;
grant select, insert, update, delete on public.document_invites to service_role;
revoke all on public.document_invites from anon, authenticated;
