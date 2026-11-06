-- Fix status history for the check-off Fix list: when a fix's status last changed and who changed
-- it. Additive (live v0.5.0 keeps working: set_fix_status and listFixes are unchanged). Re-runnable.
-- Rollback: supabase/rollbacks/20261105000023_fix_status_history.down.sql

-- fixes has no updated_at, so existing rows start with no history.
alter table public.fixes
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_changed_by uuid references auth.users (id) on delete set null;
create index if not exists fixes_status_changed_by_idx on public.fixes (status_changed_by);

-- Set on every status change (the actor is null for the service detector), kept on any other
-- update, so neither can be written directly.
create or replace function private.track_fix_status() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
    new.status_changed_by := auth.uid();
  else
    new.status_changed_at := old.status_changed_at;
    new.status_changed_by := old.status_changed_by;
  end if;
  return new;
end;
$$;
revoke all on function private.track_fix_status() from public;
drop trigger if exists fixes_track_status on public.fixes;
create trigger fixes_track_status before update on public.fixes
  for each row execute function private.track_fix_status();

-- Who changed a fix's status, for a fix the caller can see: {is_team, name} or null. A team actor
-- is is_team only; a name (sign-up metadata, never the email) shows only for a member of the business.
create or replace function private.fix_status_actor(p_fix_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when f.status_changed_by is null then null
    when exists (select 1 from public.user_roles r where r.user_id = f.status_changed_by and r.role = 'team')
      then jsonb_build_object('is_team', true, 'name', null)
    else jsonb_build_object('is_team', false, 'name', (
      select left(nullif(btrim(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name')), ''), 100)
      from auth.users u
      where u.id = f.status_changed_by
        and exists (select 1 from public.businesses bz
                    join public.workspace_members m on m.workspace_id = bz.workspace_id
                    where bz.id = f.business_id and m.user_id = f.status_changed_by)))
    end
  from public.fixes f
  where f.id = p_fix_id
    and (private.can_see_fix_list(f.business_id) or private.is_team_dfy_business(f.business_id));
$$;
revoke all on function private.fix_status_actor(uuid) from public;
grant execute on function private.fix_status_actor(uuid) to authenticated;

-- The business's done fixes, newest change first, through the fixes RLS (same visibility as the list).
create or replace function public.done_fixes(p_business_id uuid)
returns table (id uuid, rule_key text, title text, detail text, status_changed_at timestamptz, changed_by jsonb)
language sql stable security invoker set search_path = '' as $$
  select f.id, f.rule_key, f.title, f.detail, f.status_changed_at, private.fix_status_actor(f.id)
  from public.fixes f
  where f.business_id = p_business_id and f.status = 'done'
  order by f.status_changed_at desc nulls last, f.id;
$$;
revoke all on function public.done_fixes(uuid) from public, anon;
grant execute on function public.done_fixes(uuid) to authenticated;
