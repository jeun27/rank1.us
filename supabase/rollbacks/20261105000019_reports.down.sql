-- Reverts 20261105000019_reports.sql. The storage buckets are left in place (delete them through
-- the Storage API); reports rows and their columns' data are dropped with the columns.
drop function if exists public.can_write_business(uuid);
drop function if exists public.finish_report(uuid, text, text, text[], text);
drop function if exists public.claim_reports(int);
drop function if exists public.enqueue_monthly_reports(date);

drop policy if exists reports_team_read on public.reports;
drop policy if exists reports_select on public.reports;
drop policy if exists reports_member on public.reports;
create policy reports_member on public.reports for all to authenticated
  using (private.is_business_member(business_id)) with check (private.is_business_member(business_id));
drop index if exists public.reports_business_id_period_start_key;
alter table public.reports drop constraint if exists reports_status_check;
alter table public.reports
  alter column status drop default,
  drop column if exists last_error,
  drop column if exists locked_at,
  drop column if exists attempts;

grant insert (logo_path), update (logo_path) on table public.businesses to authenticated;
alter table public.businesses drop constraint if exists businesses_logo_path_check;
alter table public.businesses drop constraint if exists businesses_report_recipients_check;
alter table public.businesses drop constraint if exists businesses_brand_color_check;
drop function if exists private.valid_recipients(text[]);

drop policy if exists businesses_delete on public.businesses;
drop policy if exists businesses_update on public.businesses;
drop policy if exists businesses_insert on public.businesses;
drop policy if exists businesses_select on public.businesses;
drop policy if exists businesses_member on public.businesses;
create policy businesses_member on public.businesses for all to authenticated
  using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
drop function if exists private.can_write_business(uuid);
drop function if exists private.is_dfy_client();
revoke usage on schema private from service_role;
