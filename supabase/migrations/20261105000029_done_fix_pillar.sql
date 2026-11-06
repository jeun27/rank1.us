-- done_fixes also returns each fix's pillar (G5), for the per-group done counts. A function's
-- result columns can't change in place, so it is dropped and re-created in this transaction.
-- Rollback: supabase/rollbacks/20261105000029_done_fix_pillar.down.sql
drop function if exists public.done_fixes(uuid);
create function public.done_fixes(p_business_id uuid)
returns table (id uuid, rule_key text, title text, detail text, status_changed_at timestamptz, changed_by jsonb,
               pillar text)
language sql stable security invoker set search_path = '' as $$
  select f.id, f.rule_key, f.title, f.detail, f.status_changed_at, private.fix_status_actor(f.id), f.pillar
  from public.fixes f
  where f.business_id = p_business_id and f.status = 'done'
  order by f.status_changed_at desc nulls last, f.id;
$$;
revoke all on function public.done_fixes(uuid) from public, anon;
grant execute on function public.done_fixes(uuid) to authenticated;
