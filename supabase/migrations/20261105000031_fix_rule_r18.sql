-- Fix rule R18: a homepage that shows no text without JavaScript (G2's JS-empty state), in p5.
-- data-pipeline evaluates it in the G2 fix pass. Additive. Re-runnable.
-- Rollback: supabase/rollbacks/20261105000031_fix_rule_r18.down.sql

create or replace function private.rule_pillar(k text) returns text
language sql immutable set search_path = '' as $$
  select case
    when k in ('R10', 'R14', 'R16', 'R18') then 'p5'
    when k in ('R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R12', 'R13', 'R15', 'R17') then 'p3'
    when k ~ '^A[0-9]+$' then 'p1'
    else 'p2'
  end;
$$;
alter table public.fix_rules drop constraint if exists fix_rules_key_check;
alter table public.fix_rules add constraint fix_rules_key_check check (key ~ '^(A[1-6]|R([1-9]|1[0-8])|H1)$');

-- Copy is the lead's (GAS, 2026-11-06), generic for every vertical.
insert into public.fix_rules (key, grp, title, size, detection, data_source, cadence, threshold, unverified,
                              customer_copy, why_note, ai_lever, enabled)
values ('R18', 'restaurant', 'Your homepage needs JavaScript to show its text', 'M',
        'The G2 check: the raw HTML of the homepage has (almost) no visible words, while it loads normally.',
        'Our own fetch (raw HTML, no JavaScript)', 'weekly', null, '{}'::text[],
        'Your homepage shows almost no text without JavaScript, so ChatGPT can''t read what you offer.',
        'AI crawlers read raw HTML and do not run JavaScript. No effect claim.', true, true)
on conflict (key) do nothing;
