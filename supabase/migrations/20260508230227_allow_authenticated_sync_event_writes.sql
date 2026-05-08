-- User actions enqueue outbound sync work after local Supabase state changes.

grant select, insert, update on table public.sync_events to authenticated;

create policy "sync events can be created by the current user"
on public.sync_events
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "sync events can be updated by the current user"
on public.sync_events
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
