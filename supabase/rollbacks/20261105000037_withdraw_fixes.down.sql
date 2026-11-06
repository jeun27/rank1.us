-- Reverts 20261105000037_withdraw_fixes.sql.
drop function if exists public.withdraw_fixes(uuid, text[]);
