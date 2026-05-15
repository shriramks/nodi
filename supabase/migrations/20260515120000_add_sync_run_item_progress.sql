alter table public.sync_runs
  add column item_current integer null check (item_current >= 0),
  add column item_total integer null check (item_total >= 0),
  add column item_label text null;
