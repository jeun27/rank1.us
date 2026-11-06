-- G1 YouTube fix rules (p4), one grouped fix per check (lead Q1): the affected videos are the
-- evidence. data-pipeline evaluates them from the read-only YouTube connector. Additive.
-- Rollback: supabase/rollbacks/20261105000035_youtube_fix_rules.down.sql

create or replace function private.rule_pillar(k text) returns text
language sql immutable set search_path = '' as $$
  select case
    when k in ('R10', 'R14', 'R16', 'R18') then 'p5'
    when k in ('R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R12', 'R13', 'R15', 'R17') then 'p3'
    when k in ('R19', 'R20', 'R21') then 'p4'
    when k ~ '^A[0-9]+$' then 'p1'
    else 'p2'
  end;
$$;
alter table public.fix_rules drop constraint if exists fix_rules_key_check;
alter table public.fix_rules add constraint fix_rules_key_check check (key ~ '^(A[1-6]|R([1-9]|1[0-9]|2[01])|H1)$');

-- Plural templates; the one-video forms are data-pipeline's (as with R17). Copy: lead, in the PR.
insert into public.fix_rules (key, grp, title, size, detection, data_source, cadence, threshold, unverified,
                              customer_copy, why_note, ai_lever, enabled)
values
  ('R19', 'restaurant', 'Put your keyword in your video titles', 'S',
   'Videos whose title lacks the business''s main keyword (word match, as in G4).',
   'YouTube Data API (youtube.readonly): video titles', 'weekly', null, '{}'::text[],
   '{n} videos need your keyword in the title.',
   'Titles are the strongest on-video text AI and search read. No effect claim.', true, true),
  ('R20', 'restaurant', 'Put your keyword in the first two lines of the description', 'S',
   'Videos whose first two description lines lack the main keyword.',
   'YouTube Data API (youtube.readonly): video descriptions', 'weekly', null, '{}'::text[],
   '{n} videos don''t have your keyword in the first two lines of the description.',
   'The first lines show before "more" and are what gets quoted. No effect claim.', true, true),
  ('R21', 'restaurant', 'Add chapters on videos 5 minutes or longer', 'S',
   'Videos 5 minutes or longer (contentDetails.duration) without chapter timestamps in the description.',
   'YouTube Data API (youtube.readonly): description + contentDetails.duration', 'weekly', null, '{}'::text[],
   '{n} videos 5 minutes or longer have no chapters.',
   'Chapters give AI quotable sections; short videos don''t need them. No effect claim.', true, true)
on conflict (key) do nothing;
