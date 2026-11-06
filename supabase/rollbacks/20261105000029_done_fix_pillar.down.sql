-- Reverts 20261105000029_done_fix_pillar.sql: done_fixes without the pillar column (as in 0023).
drop function if exists public.done_fixes(uuid);
create function public.done_fixes(p_business_id uuid)
returns table (id uuid, rule_key text, title text, detail text, status_changed_at timestamptz, changed_by jsonb)
language sql stable security invoker set search_path = '' as $$
  select f.id, f.rule_key, f.title, f.detail, f.status_changed_at, private.fix_status_actor(f.id)
  from public.fixes f
  where f.business_id = p_business_id and f.status = 'done'
  order by f.status_changed_at desc nulls last, f.id;
$$;
revoke all on function public.done_fixes(uuid) from public, anon;
grant execute on function public.done_fixes(uuid) to authenticated;
