-- Reverts 20261105000021_connections.sql. Connections, tokens, the change log and interest are dropped.
drop function if exists public.record_connection_change(uuid, uuid, text, jsonb, jsonb, text);
drop function if exists public.revoke_google_grant(uuid);
drop function if exists public.set_connection_status(uuid, text);
drop function if exists public.set_connection_entities(uuid, jsonb);
drop function if exists public.update_connection_tokens(uuid, text, timestamptz, text);
drop function if exists public.get_connection_tokens(uuid);
drop function if exists public.save_connection(uuid, text, text, text[], uuid, text, text, timestamptz);
drop function if exists public.note_connector_interest(uuid, text);
drop function if exists public.can_apply_edits(uuid);
drop function if exists public.can_connect_business(uuid);

drop table if exists public.connector_interest;
drop table if exists public.connection_changes;
drop table if exists public.connection_tokens;
drop table if exists public.connections;

drop function if exists private.grant_connections(uuid);
drop function if exists private.require_service_role();
drop function if exists private.guard_connection_change();
