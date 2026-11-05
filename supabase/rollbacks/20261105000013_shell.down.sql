-- Reverts 20261105000013_shell.sql
drop function if exists public.dismiss_competitor(uuid, jsonb);
drop function if exists public.add_competitor(uuid, jsonb);
drop function if exists private.match_competitor(uuid, jsonb);
drop function if exists public.run_summaries(uuid, int, text[]);

drop policy if exists competitors_select on public.competitors;
drop policy if exists competitors_insert on public.competitors;
drop policy if exists competitors_update on public.competitors;
drop policy if exists competitors_delete on public.competitors;
drop policy if exists competitors_member on public.competitors;
create policy competitors_member on public.competitors for all to authenticated
  using (private.is_business_member(business_id)) with check (private.is_business_member(business_id));
drop function if exists private.can_write_competitors(uuid);

alter table public.businesses drop column if exists created_at;
