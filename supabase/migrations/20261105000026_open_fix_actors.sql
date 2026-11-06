-- Who/when on open fixes: the status time and actor of a business's doing fixes, for listFixes.
-- Additive (live builds never call it); reuses 0023's private.fix_status_actor. Re-runnable.
-- Rollback: supabase/rollbacks/20261105000026_open_fix_actors.down.sql

-- Through the fixes RLS (same visibility as the list). Todo rows are left out: they show no actor.
create or replace function public.open_fix_actors(p_business_id uuid)
returns table (id uuid, status_changed_at timestamptz, changed_by jsonb)
language sql stable security invoker set search_path = '' as $$
  select f.id, f.status_changed_at, private.fix_status_actor(f.id)
  from public.fixes f
  where f.business_id = p_business_id and f.status = 'doing';
$$;
revoke all on function public.open_fix_actors(uuid) from public, anon;
grant execute on function public.open_fix_actors(uuid) to authenticated;
