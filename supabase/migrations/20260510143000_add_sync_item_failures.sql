-- Durable retry context for item-level sync failures. Summary payloads stay compact,
-- while failed remote items remain queryable after cursors and snapshots advance.

create table public.sync_item_failures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sync_run_id uuid null references public.sync_runs(id) on delete set null,
  provider text not null check (provider in ('trakt', 'tmdb')),
  direction text not null check (direction in ('push', 'pull')),
  phase text not null,
  item_key text not null,
  item_payload jsonb not null default '{}'::jsonb,
  error_message text not null,
  retry_status text not null default 'pending' check (retry_status in ('pending', 'resolved')),
  attempt_count integer not null default 1 check (attempt_count > 0),
  first_failed_at timestamptz not null default now(),
  last_failed_at timestamptz not null default now(),
  resolved_at timestamptz null,
  updated_at timestamptz not null default now(),
  unique (user_id, provider, direction, phase, item_key, retry_status)
);

create index sync_item_failures_user_provider_pending_idx
  on public.sync_item_failures (user_id, provider, direction, retry_status, last_failed_at desc);

create index sync_item_failures_run_idx
  on public.sync_item_failures (sync_run_id, last_failed_at desc);

create trigger set_sync_item_failures_updated_at
before update on public.sync_item_failures
for each row
execute function public.set_updated_at();

alter table public.sync_item_failures enable row level security;

grant select on table public.sync_item_failures to authenticated;
grant select, insert, update, delete on table public.sync_item_failures to service_role;

create policy "sync item failures are readable by the current user"
on public.sync_item_failures
for select
to authenticated
using (auth.uid() = user_id);
