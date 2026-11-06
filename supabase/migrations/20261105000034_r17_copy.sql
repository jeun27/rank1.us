-- R17's customer copy follows the lead's new wording (2026-11-06, COPY.md GAS). The rule holds the
-- plural template; the one-list form ("1 list AI cites names {rivals} but not you.") is data-pipeline's.
-- Rollback: supabase/rollbacks/20261105000034_r17_copy.down.sql
update public.fix_rules set customer_copy = '{n} lists AI cite name {rivals} but not you.' where key = 'R17';
