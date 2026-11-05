-- Reverts 20261105000009_onboarding.sql
drop function if exists public.create_dfy_client(jsonb);
drop function if exists public.create_business_onboarding(jsonb);

drop policy if exists fixes_insert on public.fixes;
drop policy if exists fixes_update on public.fixes;
drop policy if exists fixes_delete on public.fixes;
create policy fixes_insert on public.fixes for insert to authenticated
  with check (private.is_business_member(business_id));
create policy fixes_update on public.fixes for update to authenticated
  using (private.is_business_member(business_id)) with check (private.is_business_member(business_id));
create policy fixes_delete on public.fixes for delete to authenticated
  using (private.is_business_member(business_id));

create or replace function private.can_see_fix_list(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.businesses bz
    where bz.id = b and (bz.service = 'self_serve' or bz.fix_list_visible)
      and private.is_business_member(bz.id)
  );
$$;
drop function if exists private.can_write_fixes(uuid);
drop function if exists private.is_team();

drop trigger if exists businesses_seat_limit on public.businesses;
create or replace function private.enforce_business_seats() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  seats int;
begin
  if auth.uid() is not null and not private.is_member(new.workspace_id) then
    return new;
  end if;
  if new.archived_at is null
     and (tg_op = 'INSERT' or old.archived_at is not null or old.workspace_id <> new.workspace_id) then
    select seats_quantity into seats from public.workspaces where id = new.workspace_id for update;
    if (select count(*) from public.businesses
        where workspace_id = new.workspace_id and archived_at is null and id <> new.id) >= seats then
      raise exception 'Workspace has no free seat for another active business' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
create trigger businesses_seat_limit
  before insert or update of archived_at, workspace_id on public.businesses
  for each row execute function private.enforce_business_seats();
