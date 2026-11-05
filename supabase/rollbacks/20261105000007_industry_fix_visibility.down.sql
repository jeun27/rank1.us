-- Reverts 20261105000007_industry_fix_visibility.sql
drop policy if exists fixes_delete on public.fixes;
drop policy if exists fixes_update on public.fixes;
drop policy if exists fixes_insert on public.fixes;
drop policy if exists fixes_select on public.fixes;
create policy fixes_member on public.fixes for all to authenticated
  using (private.is_business_member(business_id)) with check (private.is_business_member(business_id));
drop function if exists private.can_see_fix_list(uuid);

-- Back to Supabase's default table grants (revoking on the table also clears the column grants).
revoke all on table public.businesses from anon, authenticated;
grant all on table public.businesses to anon, authenticated;
alter table public.businesses drop column if exists fix_list_visible, drop column if exists service;

alter table public.contact_requests
  drop column if exists industry_other,
  drop column if exists industry;
