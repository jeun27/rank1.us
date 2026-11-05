-- Step 14: Stripe subscription state ($99 per business, quantity = active self-serve businesses).
-- The webhook is the source of truth. Additive and re-runnable.
-- Rollback: supabase/rollbacks/20261105000018_stripe.down.sql

-- Not in the members' column grants, so like the billing fields they are service-write only.
alter table public.workspaces
  add column if not exists stripe_current_period_end timestamptz,
  add column if not exists stripe_event_at timestamptz;
alter table public.businesses add column if not exists archive_at timestamptz;

-- Archives the workspace's self-serve businesses whose scheduled removal is due. Returns how many.
create or replace function private.archive_due_businesses(p_workspace_id uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  update public.businesses
  set archived_at = coalesce(archive_at, now()), archive_at = null
  where workspace_id = p_workspace_id and service = 'self_serve'
    and archived_at is null and archive_at is not null and archive_at <= now();
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function private.archive_due_businesses(uuid) from public;

-- Service role only. Records the Stripe event and applies its subscription state in one transaction;
-- an unknown workspace (not_found) or a failed apply never marks the event seen. Due removals are
-- archived before seats change. Returns 'applied' | 'duplicate' | 'stale' | 'not_found'.
create or replace function public.apply_stripe_subscription(p jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  ws public.workspaces;
  st text := p ->> 'status';
  created timestamptz := (p ->> 'event_created')::timestamptz;
  inserted text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the service role can apply Stripe events' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(p ->> 'event_id', '') = '' or coalesce(p ->> 'event_type', '') = '' or created is null then
    raise exception 'event_id, event_type and event_created are required' using errcode = 'invalid_parameter_value';
  end if;
  if st is null or st not in ('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired') then
    raise exception 'Unknown subscription status' using errcode = 'invalid_parameter_value';
  end if;
  if (p ->> 'quantity') is not null and (p ->> 'quantity')::int < 0 then
    raise exception 'Quantity must not be negative' using errcode = 'invalid_parameter_value';
  end if;

  -- Find the workspace before recording: a not_found event stays unrecorded so Stripe's retry can apply it.
  select * into ws from public.workspaces where stripe_customer_id = p ->> 'customer_id' for update;
  if not found and nullif(p ->> 'client_reference_id', '') is not null then
    select * into ws from public.workspaces
    where id = (p ->> 'client_reference_id')::uuid and (stripe_customer_id is null or stripe_customer_id = p ->> 'customer_id')
    for update;
  end if;
  if ws.id is null then
    return 'not_found';
  end if;

  insert into public.stripe_events (event_id, type) values (p ->> 'event_id', p ->> 'event_type')
  on conflict (event_id) do nothing
  returning event_id into inserted;
  if inserted is null then
    return 'duplicate';
  end if;
  if ws.stripe_event_at is not null and created < ws.stripe_event_at then
    return 'stale';
  end if;

  perform private.archive_due_businesses(ws.id);
  update public.workspaces
  set stripe_customer_id = coalesce(nullif(p ->> 'customer_id', ''), stripe_customer_id),
      stripe_subscription_id = coalesce(nullif(p ->> 'subscription_id', ''), stripe_subscription_id),
      subscription_status = st,
      seats_quantity = coalesce((p ->> 'quantity')::int, seats_quantity),
      stripe_current_period_end = coalesce((p ->> 'current_period_end')::timestamptz, stripe_current_period_end),
      stripe_event_at = created
  where id = ws.id;
  return 'applied';
end;
$$;

-- Service role only. Records an event we only acknowledge. True when it is new.
create or replace function public.record_stripe_event(p_event_id text, p_type text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  inserted text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the service role can record Stripe events' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(p_event_id, '') = '' or coalesce(p_type, '') = '' then
    raise exception 'event_id and type are required' using errcode = 'invalid_parameter_value';
  end if;
  insert into public.stripe_events (event_id, type) values (p_event_id, p_type)
  on conflict (event_id) do nothing returning event_id into inserted;
  return inserted is not null;
end;
$$;

-- Service role only. Schedules an active self-serve business for removal at the period end.
create or replace function public.schedule_business_removal(p_business_id uuid, p_at timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the service role can schedule removals' using errcode = 'insufficient_privilege';
  end if;
  if p_at is null or p_at <= now() then
    raise exception 'Removal must be in the future' using errcode = 'invalid_parameter_value';
  end if;
  update public.businesses set archive_at = p_at
  where id = p_business_id and service = 'self_serve' and archived_at is null;
  if not found then
    raise exception 'Not an active self-serve business' using errcode = 'invalid_parameter_value';
  end if;
end;
$$;

-- Service role only. Undoes a scheduled removal.
create or replace function public.cancel_business_removal(p_business_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the service role can cancel removals' using errcode = 'insufficient_privilege';
  end if;
  update public.businesses set archive_at = null
  where id = p_business_id and service = 'self_serve' and archived_at is null;
  if not found then
    raise exception 'Not an active self-serve business' using errcode = 'invalid_parameter_value';
  end if;
end;
$$;

-- Service role only. Safety net: archives every due scheduled removal. Returns how many.
create or replace function public.archive_scheduled_businesses() returns int
language plpgsql security definer set search_path = '' as $$
declare
  total int := 0;
  w uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the service role can archive' using errcode = 'insufficient_privilege';
  end if;
  for w in select distinct workspace_id from public.businesses
           where archived_at is null and archive_at is not null and archive_at <= now() loop
    total := total + private.archive_due_businesses(w);
  end loop;
  return total;
end;
$$;

-- Supabase grants EXECUTE on new public functions to anon by default.
revoke all on function public.apply_stripe_subscription(jsonb), public.record_stripe_event(text, text),
  public.schedule_business_removal(uuid, timestamptz), public.cancel_business_removal(uuid),
  public.archive_scheduled_businesses() from public, anon, authenticated;
