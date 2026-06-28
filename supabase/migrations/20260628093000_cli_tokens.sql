-- Registry of issued CLI tokens so individual devices/tokens can be revoked without
-- rotating the global signing secret. Each `easymd login` records a row (jti); every
-- CLI API call checks the token's jti is present and not revoked.
create table if not exists public.cli_tokens (
  jti         uuid primary key,
  owner_id    text not null,
  label       text,
  created_at  timestamptz not null default now(),
  last_used_at timestamptz,
  revoked     boolean not null default false
);

create index if not exists cli_tokens_owner_idx on public.cli_tokens (owner_id);

alter table public.cli_tokens enable row level security;
grant select, insert, update, delete on public.cli_tokens to service_role;
revoke all on public.cli_tokens from anon, authenticated;

comment on table public.cli_tokens is 'Issued easymd CLI tokens; server-only (service role). Revoke a row to invalidate that token.';
