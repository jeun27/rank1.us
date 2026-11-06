-- The /team client queue in one call: #161 fanned out 5 PostgREST calls per DFY client and ran out of
-- Kong worker connections at ~120 clients. Additive (live builds never call it). Re-runnable.
-- Rollback: supabase/rollbacks/20261105000038_team_client_queue.down.sql

-- Rank1 team only (42501). One row per active DFY business, by name, counted exactly as loadQueue did:
-- of the latest 3 audit/weekly runs, visibility = the newest complete/partial run's ok answers
-- (named/n, like run_summaries); delta = its floored % minus the next one's; last_run_failed = newest.
create or replace function public.team_client_queue()
returns table (id uuid, name text, named int, n int, delta int, open_fixes int, started boolean,
               gas_ready boolean, needs_reauth boolean, last_run_failed boolean)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not private.is_team() then
    raise exception 'Only the Rank1 team can read the client queue' using errcode = 'insufficient_privilege';
  end if;
  return query
  with biz as (
    select b.id, b.name, b.gas_ready_at from public.businesses b
    where b.service = 'dfy' and b.archived_at is null
  ), latest as (
    select bz.id as business_id, r.id as run_id, r.status, r.rn
    from biz bz
    cross join lateral (
      select ru.id, ru.status, row_number() over (order by ru.started_at desc nulls last, ru.id) as rn
      from public.runs ru
      where ru.business_id = bz.id and ru.kind in ('audit', 'weekly')
      order by ru.started_at desc nulls last, ru.id
      limit 3
    ) r
  ), good as (
    select l.business_id, l.run_id,
           row_number() over (partition by l.business_id order by l.rn) as g,
           (select count(*) filter (where an.mentioned) from public.answers an
            where an.run_id = l.run_id and an.status = 'ok' and an.question_id is not null)::int as named,
           (select count(*) from public.answers an
            where an.run_id = l.run_id and an.status = 'ok' and an.question_id is not null)::int as n
    from latest l
    where l.status in ('complete', 'partial')
  )
  select bz.id, bz.name, g1.named, g1.n,
         case when g1.n > 0 and g2.n > 0 then (g1.named * 100) / g1.n - (g2.named * 100) / g2.n end,
         (select count(*) from public.fixes f where f.business_id = bz.id and f.status in ('todo', 'doing'))::int,
         exists (select 1 from public.fixes f
                 left join public.fix_rules fr on fr.key = f.rule_key
                 where f.business_id = bz.id
                   and (f.status = 'done' or (f.status = 'doing' and fr.grp is distinct from 'hygiene'))),
         bz.gas_ready_at is not null,
         exists (select 1 from public.connections c where c.business_id = bz.id and c.status = 'needs_reauth'),
         coalesce((select l.status = 'failed' from latest l where l.business_id = bz.id and l.rn = 1), false)
  from biz bz
  left join good g1 on g1.business_id = bz.id and g1.g = 1
  left join good g2 on g2.business_id = bz.id and g2.g = 2
  order by bz.name, bz.id;
end;
$$;
revoke all on function public.team_client_queue() from public, anon;
grant execute on function public.team_client_queue() to authenticated;
