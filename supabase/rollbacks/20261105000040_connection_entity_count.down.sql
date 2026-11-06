-- Reverts 20261105000040_connection_entity_count.sql.
drop function if exists public.set_connection_entity_count(uuid, int);
alter table public.connections drop column if exists entity_count;
