-- #22 Contact industry and #23 fix list visibility.
-- Rollback: supabase/rollbacks/20261105000007_industry_fix_visibility.down.sql

-- #22: the default only backfills existing rows; new rows must name an industry.
alter table public.contact_requests
  add column industry text not null default 'Other'
    constraint contact_requests_industry_check
    check (industry in ('Restaurant', 'HVAC', 'Plumbing', 'Roofing', 'Pest control', 'Other')),
  add column industry_other text
    constraint contact_requests_industry_other_length_check check (char_length(industry_other) <= 60),
  add constraint contact_requests_industry_other_only_other_check
    check (industry_other is null or industry = 'Other');
alter table public.contact_requests alter column industry drop default;

-- #23: self-serve members always see their fix list; done-for-you members only once
-- the Rank1 team turns fix_list_visible on. The team itself reads through the service role.
alter table public.businesses
  add column service text not null default 'self_serve'
    constraint businesses_service_check check (service in ('self_serve', 'dfy')),
  add column fix_list_visible boolean not null default false;

-- service and fix_list_visible are service-role only, like the workspace billing fields.
-- A new businesses column must be added to these grants to be member-writable.
revoke all on table public.businesses from anon, authenticated;
grant select, delete on table public.businesses to authenticated;
grant insert (id, workspace_id, name, domain, aliases, vertical, cuisine, city, state, country,
              brand_color, logo_path, report_recipients, ga4_property_id, archived_at)
  on table public.businesses to authenticated;
grant update (id, workspace_id, name, domain, aliases, vertical, cuisine, city, state, country,
              brand_color, logo_path, report_recipients, ga4_property_id, archived_at)
  on table public.businesses to authenticated;

create function private.can_see_fix_list(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.businesses bz
    where bz.id = b and (bz.service = 'self_serve' or bz.fix_list_visible)
      and private.is_business_member(bz.id)
  );
$$;
revoke all on function private.can_see_fix_list(uuid) from public;
grant execute on function private.can_see_fix_list(uuid) to authenticated;

-- Split the old FOR ALL policy: a FOR ALL policy also grants SELECT.
drop policy fixes_member on public.fixes;
create policy fixes_select on public.fixes for select to authenticated
  using (private.can_see_fix_list(business_id));
create policy fixes_insert on public.fixes for insert to authenticated
  with check (private.is_business_member(business_id));
create policy fixes_update on public.fixes for update to authenticated
  using (private.is_business_member(business_id)) with check (private.is_business_member(business_id));
create policy fixes_delete on public.fixes for delete to authenticated
  using (private.is_business_member(business_id));
