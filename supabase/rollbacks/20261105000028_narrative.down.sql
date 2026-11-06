-- Reverts 20261105000028_narrative.sql. The word lists are dropped.
drop function if exists public.set_narrative_words(uuid, text[], text[]);
drop function if exists private.clean_words(text[]);
alter table public.businesses drop constraint if exists businesses_narrative_words_check;
alter table public.businesses
  drop column if exists narrative_avoid,
  drop column if exists narrative_want;
drop function if exists private.valid_narrative_words(text[]);
