-- Reverts 20261105000001_tenancy.sql
drop table if exists public.questions;
drop table if exists public.competitors;
drop table if exists public.businesses;
drop table if exists public.workspace_members;
drop table if exists public.workspaces;
drop function if exists private.is_business_member(uuid);
drop function if exists private.add_owner_member();
drop function if exists private.is_owner(uuid);
drop function if exists private.is_member(uuid);
drop schema if exists private;
