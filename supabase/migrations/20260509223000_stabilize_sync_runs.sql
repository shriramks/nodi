-- Durable sync run lifecycle state. sync_events remains the append-only event log,
-- while sync_runs tracks the current/last run and owns cancellation.

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('trakt', 'tmdb')),
  direction text not null check (direction in ('push', 'pull')),
  status text not null default 'running' check (status in ('running', 'success', 'error', 'cancelled')),
  phase text not null default 'connect',
  label text not null default 'Starting sync',
  current integer not null default 0 check (current >= 0),
  total integer not null default 0 check (total >= 0),
  summary jsonb not null default '{}'::jsonb,
  error_message text null,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz null,
  cancelled_at timestamptz null
);

create unique index sync_runs_one_running_per_user_provider_idx
  on public.sync_runs (user_id, provider)
  where status = 'running';

create index sync_runs_user_provider_started_idx
  on public.sync_runs (user_id, provider, started_at desc);

create index sync_runs_user_provider_status_updated_idx
  on public.sync_runs (user_id, provider, status, updated_at desc);

create trigger set_sync_runs_updated_at
before update on public.sync_runs
for each row
execute function public.set_updated_at();

alter table public.sync_runs enable row level security;

grant select on table public.sync_runs to authenticated;
grant select, insert, update, delete on table public.sync_runs to service_role;

create policy "sync runs are readable by the current user"
on public.sync_runs
for select
to authenticated
using (auth.uid() = user_id);
