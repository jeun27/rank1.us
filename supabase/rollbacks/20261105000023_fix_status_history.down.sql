-- Reverts 20261105000023_fix_status_history.sql. The history columns and their data are dropped.
drop function if exists public.done_fixes(uuid);
drop function if exists private.fix_status_actor(uuid);
drop trigger if exists fixes_track_status on public.fixes;
drop function if exists private.track_fix_status();
drop index if exists public.fixes_status_changed_by_idx;
alter table public.fixes
  drop column if exists status_changed_by,
  drop column if exists status_changed_at;
