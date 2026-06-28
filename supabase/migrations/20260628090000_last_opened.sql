-- Track when each document was last opened in the editor, so the dashboard can sort
-- by "recently opened" (priority) and fall back to "recently added/updated".
alter table public.documents add column if not exists last_opened_at timestamptz;

create index if not exists documents_last_opened_idx on public.documents (owner_id, last_opened_at desc nulls last);

comment on column public.documents.last_opened_at is 'When the owner last opened this document in the editor (drives dashboard ordering).';
