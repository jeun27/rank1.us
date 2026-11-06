-- G2: free audits still needing an AI access check, for data-pipeline's run-jobs hook. Paid runs
-- ride the existing fix pass. Additive (live builds never call it). Re-runnable.
-- Rollback: supabase/rollbacks/20261105000032_ai_access_pending.down.sql

-- Service role only. Complete/partial free_audit runs started in the last 7 days (old audits never
-- backfill) with no ai_access_checks row, oldest first. The domain is the free audit's snapshot domain.
create or replace function public.runs_needing_ai_access_check(p_limit int)
returns table (run_id uuid, domain text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role only' using errcode = 'insufficient_privilege';
  end if;
  return query
  select r.id, fa.domain
  from public.runs r
  join public.free_audits fa on fa.run_id = r.id
  where r.kind = 'free_audit' and r.status in ('complete', 'partial')
    and r.started_at >= now() - interval '7 days'
    and not exists (select 1 from public.ai_access_checks c where c.run_id = r.id)
  order by r.started_at, r.id
  limit least(greatest(coalesce(p_limit, 0), 0), 100);
end;
$$;
revoke all on function public.runs_needing_ai_access_check(int) from public, anon, authenticated;
