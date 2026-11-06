-- Withdraw unstarted YouTube fixes (R19-R21) of a business, for the weekly pass when the business
-- isn't youtubeReady. R16-R18 keep "ok → done". Additive (live builds never call it).
-- Rollback: supabase/rollbacks/20261105000037_withdraw_fixes.down.sql

-- Service role only. Deletes only todo fixes for those keys (doing and done are kept); an unstarted
-- todo has no history to keep. Returns the count. 22023 for any key outside R19-R21 or an empty list.
create or replace function public.withdraw_fixes(p_business_id uuid, p_rule_keys text[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role only' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(cardinality(p_rule_keys), 0) = 0
     or exists (select 1 from unnest(p_rule_keys) k where k is null or k not in ('R19', 'R20', 'R21')) then
    raise exception 'Only R19, R20 and R21 can be withdrawn' using errcode = 'invalid_parameter_value';
  end if;
  delete from public.fixes
  where business_id = p_business_id and rule_key = any (p_rule_keys) and status = 'todo';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.withdraw_fixes(uuid, text[]) from public, anon, authenticated;
