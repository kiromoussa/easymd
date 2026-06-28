-- Per-account preferences. `sync_special` controls whether the CLI auto-sync includes
-- the "load-bearing" agent files (CLAUDE.md, README.md, AGENTS.md). Default false:
-- those are NOT auto-added unless the user opts in from the dashboard.
create table if not exists public.user_settings (
  owner_id     text primary key,
  sync_special boolean not null default false,
  updated_at   timestamptz not null default now()
);
alter table public.user_settings enable row level security;
grant select, insert, update, delete on public.user_settings to service_role;
revoke all on public.user_settings from anon, authenticated;
