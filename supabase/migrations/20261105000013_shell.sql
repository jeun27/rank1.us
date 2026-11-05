-- Step 8: self-serve shell. Competitor writes for self-serve or team only, run summaries, and
-- add/dismiss competitor RPCs. Additive and re-runnable in one transaction.
-- Rollback: supabase/rollbacks/20261105000013_shell.down.sql

-- "Oldest active business" needs an order. Existing rows get the migration time (ties go by id).
alter table public.businesses add column if not exists created_at timestamptz not null default now();

-- Competitors: members read; only self-serve businesses or the Rank1 team write (a dfy_client never does).
create or replace function private.can_write_competitors(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.businesses bz
    where bz.id = b and (bz.service = 'self_serve' or private.is_team())
      and private.is_business_member(bz.id)
  );
$$;
revoke all on function private.can_write_competitors(uuid) from public;
grant execute on function private.can_write_competitors(uuid) to authenticated;

drop policy if exists competitors_member on public.competitors;
drop policy if exists competitors_select on public.competitors;
drop policy if exists competitors_insert on public.competitors;
drop policy if exists competitors_update on public.competitors;
drop policy if exists competitors_delete on public.competitors;
create policy competitors_select on public.competitors for select to authenticated
  using (private.is_business_member(business_id));
create policy competitors_insert on public.competitors for insert to authenticated
  with check (private.can_write_competitors(business_id));
create policy competitors_update on public.competitors for update to authenticated
  using (private.can_write_competitors(business_id)) with check (private.can_write_competitors(business_id));
create policy competitors_delete on public.competitors for delete to authenticated
  using (private.can_write_competitors(business_id));

-- Audit/weekly runs of a business, newest first, with visibility counts using computeMetrics'
-- exclusions: only ok answers whose question still exists; named = mentioned. RLS applies.
create or replace function public.run_summaries(p_business_id uuid, p_limit int default 8)
returns table (run_id uuid, kind text, status text, jobs_total int, jobs_ok int, jobs_failed int,
               started_at timestamptz, finished_at timestamptz, named int, n int, per_engine jsonb)
language sql stable security invoker set search_path = '' as $$
  with r as (
    select ru.* from public.runs ru
    where ru.business_id = p_business_id and ru.kind in ('audit', 'weekly')
    order by ru.started_at desc nulls last, ru.id
    limit greatest(coalesce(p_limit, 8), 0)
  ), c as (
    select an.run_id, an.engine, count(*)::int as n, (count(*) filter (where an.mentioned))::int as named
    from public.answers an
    join r on r.id = an.run_id
    where an.status = 'ok' and an.question_id is not null
    group by an.run_id, an.engine
  )
  select r.id, r.kind, r.status, r.jobs_total, r.jobs_ok, r.jobs_failed, r.started_at, r.finished_at,
         coalesce((select sum(c.named) from c where c.run_id = r.id), 0)::int,
         coalesce((select sum(c.n) from c where c.run_id = r.id), 0)::int,
         (select jsonb_object_agg(e.engine, jsonb_build_object('named', coalesce(c.named, 0), 'n', coalesce(c.n, 0)))
          from unnest(array['chatgpt', 'gemini', 'google_aio', 'perplexity']) as e(engine)
          left join c on c.run_id = r.id and c.engine = e.engine)
  from r
  order by r.started_at desc nulls last, r.id;
$$;

-- Shared input checks and row match for the competitor RPCs: same domain, else same name.
create or replace function private.match_competitor(p_business_id uuid, p jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  nm text := btrim(p ->> 'name');
  dom text := lower(nullif(btrim(p ->> 'domain'), ''));
  found_id uuid;
begin
  if coalesce(nm, '') = '' or char_length(nm) > 200 then
    raise exception 'Competitor name is required (at most 200 characters)' using errcode = 'invalid_parameter_value';
  end if;
  if dom is not null and not private.is_hostname(dom) then
    raise exception 'Competitor domain must be a valid hostname' using errcode = 'invalid_parameter_value';
  end if;
  if (p ->> 'rating') is not null and (p ->> 'rating')::numeric not between 0 and 5 then
    raise exception 'Competitor rating must be between 0 and 5' using errcode = 'invalid_parameter_value';
  end if;
  if not private.can_write_competitors(p_business_id) then
    raise exception 'Not allowed to change competitors for this business' using errcode = 'insufficient_privilege';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('competitors:' || p_business_id::text, 0));
  select co.id into found_id from public.competitors co
  where co.business_id = p_business_id
    and ((dom is not null and lower(co.domain) = dom) or lower(co.name) = lower(nm))
  order by coalesce(lower(co.domain) = dom, false) desc, co.hidden, co.id
  limit 1;
  return found_id;
end;
$$;

-- Tracks a competitor (source maps or manual). A matching row is un-hidden instead of duplicated.
create or replace function public.add_competitor(p_business_id uuid, p jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  src text := coalesce(p ->> 'source', 'manual');
  cid uuid;
begin
  if src not in ('maps', 'manual') then
    raise exception 'Competitor source must be maps or manual' using errcode = 'invalid_parameter_value';
  end if;
  cid := private.match_competitor(p_business_id, p);
  if cid is not null then
    update public.competitors
    set hidden = false,
        source = case when source = 'suggested' then src else source end,
        domain = coalesce(domain, lower(nullif(btrim(p ->> 'domain'), ''))),
        maps_cid = coalesce(maps_cid, p ->> 'maps_cid'),
        rating = coalesce((p ->> 'rating')::numeric, rating)
    where id = cid;
    return cid;
  end if;
  insert into public.competitors (business_id, name, domain, source, maps_cid, rating, hidden)
  values (p_business_id, btrim(p ->> 'name'), lower(nullif(btrim(p ->> 'domain'), '')), src,
          p ->> 'maps_cid', (p ->> 'rating')::numeric, false)
  returning id into cid;
  return cid;
end;
$$;

-- "Not a competitor": hides a matching row, or stores it hidden with source 'suggested'. Idempotent.
create or replace function public.dismiss_competitor(p_business_id uuid, p jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  cid uuid;
begin
  cid := private.match_competitor(p_business_id, p);
  if cid is not null then
    update public.competitors set hidden = true where id = cid;
    return cid;
  end if;
  insert into public.competitors (business_id, name, domain, source, maps_cid, rating, hidden)
  values (p_business_id, btrim(p ->> 'name'), lower(nullif(btrim(p ->> 'domain'), '')), 'suggested',
          p ->> 'maps_cid', (p ->> 'rating')::numeric, true)
  returning id into cid;
  return cid;
end;
$$;

-- Supabase grants EXECUTE on new public functions to anon by default.
revoke all on function public.run_summaries(uuid, int), public.add_competitor(uuid, jsonb),
  public.dismiss_competitor(uuid, jsonb) from public, anon;
grant execute on function public.run_summaries(uuid, int), public.add_competitor(uuid, jsonb),
  public.dismiss_competitor(uuid, jsonb) to authenticated;
revoke all on function private.match_competitor(uuid, jsonb) from public;
grant execute on function private.match_competitor(uuid, jsonb) to authenticated;
