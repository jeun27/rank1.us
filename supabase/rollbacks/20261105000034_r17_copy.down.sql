-- Reverts 20261105000034_r17_copy.sql: R17's copy goes back to its 0030 wording.
update public.fix_rules set customer_copy = '{n} lists AI cites name {rivals} but not you.' where key = 'R17';
