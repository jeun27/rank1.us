-- Reverts 20261105000008_roles.sql
drop function if exists public.my_landing();
drop function if exists public.ensure_self_serve_workspace();
drop table if exists public.user_roles;
