-- Reverts 20261105000026_open_fix_actors.sql.
drop function if exists public.open_fix_actors(uuid);
revoke execute on function private.fix_status_actor(uuid) from service_role;
