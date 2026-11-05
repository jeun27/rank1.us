-- Step 13: weekly runs (Monday 06:00 America/Los_Angeles, driven by /api/cron/weekly) and pruning
-- of the short-lived onboarding tables. Additive and re-runnable.
-- Rollback: supabase/rollbacks/20261105000017_weekly.down.sql

-- Service role only. Starts this week's weekly run for every active business that is paid
-- (active/trialing) or DFY, skipping one that already has a weekly run this ISO week (LA time)
-- or an open run. The business row lock makes a second, concurrent call skip what the first made.
create or replace function public.enqueue_weekly_runs(p_week_start date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  w_from timestamptz;
  w_to timestamptz;
  b record;
  enqueued int := 0;
  skipped int := 0;
  failed int := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the service role can enqueue weekly runs' using errcode = 'insufficient_privilege';
  end if;
  if p_week_start is null or extract(isodow from p_week_start) <> 1 then
    raise exception 'Week start must be a Monday' using errcode = 'invalid_parameter_value';
  end if;
  w_from := p_week_start::timestamp at time zone 'America/Los_Angeles';
  w_to := (p_week_start + 7)::timestamp at time zone 'America/Los_Angeles';
  if now() < w_from or now() >= w_to then
    raise exception 'Week start must be the current week in America/Los_Angeles' using errcode = 'invalid_parameter_value';
  end if;

  for b in
    select bz.id from public.businesses bz
    join public.workspaces w on w.id = bz.workspace_id
    where bz.archived_at is null
      and (bz.service = 'dfy' or coalesce(w.subscription_status, '') in ('active', 'trialing'))
    order by bz.created_at, bz.id
  loop
    perform 1 from public.businesses where id = b.id for update;
    if exists (
      select 1 from public.runs r
      where r.business_id = b.id
        and ((r.kind = 'weekly' and r.started_at >= w_from and r.started_at < w_to)
             or r.status in ('queued', 'running'))
    ) then
      skipped := skipped + 1;
      continue;
    end if;
    begin
      perform public.create_run(b.id, 'weekly');
      enqueued := enqueued + 1;
    exception
      when invalid_parameter_value then
        skipped := skipped + 1;  -- e.g. no active questions: nothing to check
      when others then
        failed := failed + 1;
    end;
  end loop;
  return jsonb_build_object('enqueued', enqueued, 'skipped', skipped, 'failed', failed);
end;
$$;

-- Service role only. Deletes lookup_cache rows over 24 h old and rate_events over 48 h old.
create or replace function public.prune_ephemeral() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  cache_n int;
  rate_n int;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the service role can prune' using errcode = 'insufficient_privilege';
  end if;
  delete from public.lookup_cache where created_at < now() - interval '24 hours';
  get diagnostics cache_n = row_count;
  delete from public.rate_events where created_at < now() - interval '48 hours';
  get diagnostics rate_n = row_count;
  return jsonb_build_object('lookup_cache', cache_n, 'rate_events', rate_n);
end;
$$;

-- Supabase grants EXECUTE on new public functions to anon by default.
revoke all on function public.enqueue_weekly_runs(date), public.prune_ephemeral() from public, anon, authenticated;
