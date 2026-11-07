-- Reverts 20261105000042_free_audit_for_business.sql.
drop function if exists public.free_audit_for_business(uuid);
drop function if exists private.site_host(text);
