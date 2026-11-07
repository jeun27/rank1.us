-- Onboarding v2 (O1, BE2): the latest free audit that is the business's own, for the locked Dashboard
-- headline. Lead P4: it counts only when its domain AND its lead email match the business's domain and
-- its workspace owner's email. Additive (live builds never call it). Re-runnable.
-- Rollback: supabase/rollbacks/20261105000042_free_audit_for_business.down.sql

-- A host compared as the same site: lowercase, no trailing dot, no leading "www." (www.x.com = x.com).
create or replace function private.site_host(h text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(rtrim(lower(btrim(h)), '.'), '^www\.', '');
$$;
revoke all on function private.site_host(text) from public;

-- Definer (free_audits, leads and auth.users are service-only). Members of the business only; anyone
-- else gets no row; anon is refused. Only complete/partial audits; named/n = its ok answers, as the
-- free-audit page counts them. Returns no email, token or brand list.
create or replace function public.free_audit_for_business(p_business_id uuid)
returns table (run_id uuid, named int, n int, checked_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id,
         (select count(*) filter (where a.mentioned) from public.answers a where a.run_id = r.id and a.status = 'ok')::int,
         (select count(*) from public.answers a where a.run_id = r.id and a.status = 'ok')::int,
         r.finished_at
  from public.businesses b
  join public.workspaces w on w.id = b.workspace_id
  join auth.users u on u.id = w.owner_id
  join public.free_audits fa on private.site_host(fa.domain) = private.site_host(b.domain)
  join public.leads l on l.id = fa.lead_id and lower(l.email) = lower(u.email)
  join public.runs r on r.id = fa.run_id and r.status in ('complete', 'partial')
  where b.id = p_business_id and private.is_business_member(p_business_id)
  order by r.finished_at desc nulls last, r.id
  limit 1;
$$;
revoke all on function public.free_audit_for_business(uuid) from public, anon;
grant execute on function public.free_audit_for_business(uuid) to authenticated;
