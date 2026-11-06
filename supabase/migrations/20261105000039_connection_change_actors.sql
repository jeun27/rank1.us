-- For the change log (frontend #160): whether each change of a business was made by the Rank1 team.
-- Like open_fix_actors (0026). Additive (live builds never call it). Re-runnable.
-- Rollback: supabase/rollbacks/20261105000039_connection_change_actors.down.sql

-- Definer (it reads user_roles), gated exactly like connection_changes_read: the business's members
-- (incl. its dfy_client) and the team on DFY; anyone else gets no rows. Only the team flag is returned:
-- no names or emails. A removed user (no role row) is not the team.
create or replace function public.connection_change_actors(p_business_id uuid)
returns table (change_id uuid, actor_is_team boolean)
language sql stable security definer set search_path = '' as $$
  select cc.id, exists (select 1 from public.user_roles r where r.user_id = cc.actor and r.role = 'team')
  from public.connection_changes cc
  where cc.business_id = p_business_id
    and (private.is_business_member(p_business_id) or private.is_team_dfy_business(p_business_id))
  order by cc.created_at desc, cc.id;
$$;
revoke all on function public.connection_change_actors(uuid) from public, anon;
grant execute on function public.connection_change_actors(uuid) to authenticated;
