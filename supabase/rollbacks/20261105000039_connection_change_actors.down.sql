-- Reverts 20261105000039_connection_change_actors.sql.
drop function if exists public.connection_change_actors(uuid);
