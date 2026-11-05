-- Plan limits, enforced for every role including the service role.
-- Triggers fire before RLS, so rows the caller cannot access are passed through
-- untouched; RLS then rejects them without revealing another workspace's counts.
-- Rollback: supabase/rollbacks/20261105000006_limits.down.sql

-- At most 25 active questions per business. Locking the business row serializes
-- concurrent inserts so two requests cannot both take the 25th slot.
create function private.enforce_active_question_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not private.is_business_member(new.business_id) then
    return new;
  end if;
  if new.active and (tg_op = 'INSERT' or not old.active or old.business_id <> new.business_id) then
    perform 1 from public.businesses where id = new.business_id for update;
    if (select count(*) from public.questions
        where business_id = new.business_id and active and id <> new.id) >= 25 then
      raise exception 'A business can have at most 25 active questions' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;
create trigger questions_active_limit
  before insert or update of active, business_id on public.questions
  for each row execute function private.enforce_active_question_limit();

-- Active (not archived) businesses per workspace may not exceed seats_quantity.
-- Covers insert, un-archiving and moving a business to another workspace.
create function private.enforce_business_seats() returns trigger
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

revoke all on function private.enforce_active_question_limit(), private.enforce_business_seats() from public;
