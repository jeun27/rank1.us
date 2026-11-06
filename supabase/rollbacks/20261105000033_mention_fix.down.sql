-- Reverts 20261105000033_mention_fix.sql. R17 fixes already made stay (they belong to fixes).
drop function if exists public.upsert_mention_fix(uuid, text);
