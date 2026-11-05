-- Reverts 20261105000016_client_invites.sql (granted roles and memberships stay).
drop function if exists public.list_client_users(uuid);
drop function if exists public.set_fix_list_visible(uuid, boolean);
drop function if exists public.revoke_dfy_client(uuid, uuid);
drop function if exists public.grant_dfy_client(uuid, uuid);
drop function if exists public.client_invite_status(text, uuid);
