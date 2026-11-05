-- Step 16: white-label monthly reports, private storage, report settings, and the businesses write
-- gate (a dfy_client never writes its business). Additive and re-runnable.
-- Rollback: supabase/rollbacks/20261105000019_reports.down.sql

-- Private buckets. No storage.objects policies: the server uploads and signs URLs with the service
-- role after the caller's own client proves access. Limits are set when the column exists.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public) values ('reports', 'reports', false), ('logos', 'logos', false)
    on conflict (id) do update set public = false;
    if exists (select 1 from information_schema.columns
               where table_schema = 'storage' and table_name = 'buckets' and column_name = 'file_size_limit') then
      update storage.buckets set file_size_limit = 10485760, allowed_mime_types = array['application/pdf'] where id = 'reports';
      update storage.buckets set file_size_limit = 524288, allowed_mime_types = array['image/png', 'image/jpeg'] where id = 'logos';
    end if;
  end if;
end;
$$;

-- Businesses write gate. SELECT stays for members (+ team on DFY, 0015). Writes: self-serve
-- members (never a dfy_client), or the team on a DFY business. Definer RPCs are unaffected.
create or replace function private.is_dfy_client() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'dfy_client');
$$;

create or replace function private.can_write_business(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.businesses bz
    where bz.id = b
      and ((bz.service = 'self_serve' and private.is_member(bz.workspace_id) and not private.is_dfy_client())
           or (private.is_team() and bz.service = 'dfy'))
  );
$$;

revoke all on function private.is_dfy_client(), private.can_write_business(uuid) from public;
grant execute on function private.is_dfy_client(), private.can_write_business(uuid) to authenticated;

drop policy if exists businesses_member on public.businesses;
drop policy if exists businesses_select on public.businesses;
drop policy if exists businesses_insert on public.businesses;
drop policy if exists businesses_update on public.businesses;
drop policy if exists businesses_delete on public.businesses;
create policy businesses_select on public.businesses for select to authenticated
  using (private.is_member(workspace_id));
create policy businesses_insert on public.businesses for insert to authenticated
  with check (service = 'self_serve' and private.is_member(workspace_id) and not private.is_dfy_client());
create policy businesses_update on public.businesses for update to authenticated
  using (private.can_write_business(id))
  with check ((service = 'self_serve' and private.is_member(workspace_id) and not private.is_dfy_client())
              or (private.is_team() and service = 'dfy'));
create policy businesses_delete on public.businesses for delete to authenticated
  using (private.can_write_business(id));

-- Report settings. logo_path is set only by the server after a validated upload.
create or replace function private.valid_recipients(r text[]) returns boolean
language sql immutable set search_path = '' as $$
  select r is null or (
    coalesce(cardinality(r), 0) <= 10
    and not exists (
      select 1 from unnest(r) as e
      where e is null or e <> lower(btrim(e)) or char_length(e) > 254 or e !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
    )
  );
$$;

alter table public.businesses drop constraint if exists businesses_brand_color_check;
alter table public.businesses add constraint businesses_brand_color_check
  check (brand_color is null or brand_color ~ '^#[0-9A-Fa-f]{6}$') not valid;
alter table public.businesses drop constraint if exists businesses_report_recipients_check;
alter table public.businesses add constraint businesses_report_recipients_check
  check (private.valid_recipients(report_recipients)) not valid;
alter table public.businesses drop constraint if exists businesses_logo_path_check;
alter table public.businesses add constraint businesses_logo_path_check
  check (logo_path is null or logo_path like id::text || '/%') not valid;
revoke insert (logo_path), update (logo_path) on table public.businesses from authenticated;

-- Reports: one per business per month, read by members (and the team on DFY), written by the
-- service role only through enqueue / claim / finish.
alter table public.reports
  add column if not exists attempts int not null default 0,
  add column if not exists locked_at timestamptz,
  add column if not exists last_error text,
  alter column status set default 'queued';
alter table public.reports drop constraint if exists reports_status_check;
alter table public.reports add constraint reports_status_check
  check (status in ('queued', 'rendering', 'generated', 'sent', 'failed')) not valid;
create unique index if not exists reports_business_id_period_start_key on public.reports (business_id, period_start);

drop policy if exists reports_member on public.reports;
drop policy if exists reports_select on public.reports;
drop policy if exists reports_team_read on public.reports;
create policy reports_select on public.reports for select to authenticated
  using (private.is_business_member(business_id));
create policy reports_team_read on public.reports for select to authenticated
  using (private.is_team_dfy_business(business_id));

-- Service role only. Queues last month's report for every eligible business (paid or DFY, not
-- archived). p_month must be the 1st of the previous month in America/Los_Angeles. Idempotent.
create or replace function public.enqueue_monthly_reports(p_month date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  expected date := date_trunc('month', (now() at time zone 'America/Los_Angeles') - interval '1 month')::date;
  eligible int;
  enqueued int;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the service role can enqueue reports' using errcode = 'insufficient_privilege';
  end if;
  if p_month is null or p_month <> expected then
    raise exception 'Month must be the first day of the previous month in America/Los_Angeles'
      using errcode = 'invalid_parameter_value';
  end if;
  with candidates as (
    select bz.id from public.businesses bz
    join public.workspaces w on w.id = bz.workspace_id
    where bz.archived_at is null
      and (bz.service = 'dfy' or coalesce(w.subscription_status, '') in ('active', 'trialing'))
  ), inserted as (
    insert into public.reports (business_id, period_start, period_end, status)
    select c.id, p_month, (p_month + interval '1 month' - interval '1 day')::date, 'queued' from candidates c
    on conflict (business_id, period_start) do nothing
    returning 1
  )
  select (select count(*) from candidates), (select count(*) from inserted) into eligible, enqueued;
  return jsonb_build_object('enqueued', enqueued, 'skipped', eligible - enqueued);
end;
$$;

-- Service role only. Claims queued reports, or rendering ones locked over 10 minutes ago; one at
-- 3 attempts is marked failed instead. Returns {report_id, business_id, period_start, period_end, attempt}.
create or replace function public.claim_reports(p_limit int) returns setof jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the service role can claim reports' using errcode = 'insufficient_privilege';
  end if;
  if p_limit is null or p_limit < 1 then
    return;
  end if;
  update public.reports
  set status = 'failed', locked_at = null, last_error = 'Gave up after 3 attempts'
  where status = 'rendering' and locked_at < now() - interval '10 minutes' and attempts >= 3;

  return query
  with picked as (
    select id from public.reports
    where status = 'queued' or (status = 'rendering' and locked_at < now() - interval '10 minutes' and attempts < 3)
    order by period_start, id
    limit p_limit
    for update skip locked
  ), claimed as (
    update public.reports r set status = 'rendering', locked_at = now(), attempts = r.attempts + 1
    from picked where r.id = picked.id
    returning r.*
  )
  select jsonb_build_object('report_id', c.id, 'business_id', c.business_id, 'period_start', c.period_start,
                            'period_end', c.period_end, 'attempt', c.attempts)
  from claimed c
  order by c.period_start, c.id;
end;
$$;

-- Service role only. Closes a rendering report: generated (stored, nothing sent), sent or failed.
-- A report that is not rendering is left alone (returns false), so a repeat is a no-op.
create or replace function public.finish_report(p_report_id uuid, p_status text, p_pdf_path text,
                                                p_sent_to text[], p_error text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  r public.reports;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the service role can finish reports' using errcode = 'insufficient_privilege';
  end if;
  if p_status is null or p_status not in ('generated', 'sent', 'failed') then
    raise exception 'Status must be generated, sent or failed' using errcode = 'invalid_parameter_value';
  end if;
  select * into r from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'Unknown report' using errcode = 'invalid_parameter_value';
  end if;
  if r.status <> 'rendering' then
    return false;
  end if;
  if p_status <> 'failed' and (p_pdf_path is null or p_pdf_path not like r.business_id::text || '/%') then
    raise exception 'pdf_path must be under the business id' using errcode = 'invalid_parameter_value';
  end if;
  if p_status = 'sent' and (coalesce(cardinality(p_sent_to), 0) = 0 or not private.valid_recipients(p_sent_to)) then
    raise exception 'A sent report needs 1 to 10 valid recipients' using errcode = 'invalid_parameter_value';
  end if;
  update public.reports
  set status = p_status, locked_at = null,
      pdf_path = coalesce(p_pdf_path, pdf_path),
      sent_to = case when p_status = 'sent' then p_sent_to else '{}' end,
      sent_at = case when p_status = 'sent' then now() end,
      last_error = case when p_status = 'failed' then left(p_error, 1000) end
  where id = r.id;
  return true;
end;
$$;

-- Whether the caller may change this business (report settings, logo). For server-side checks.
create or replace function public.can_write_business(p_business_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_write_business(p_business_id);
$$;

-- Supabase grants EXECUTE on new public functions to anon by default.
revoke all on function public.enqueue_monthly_reports(date), public.claim_reports(int),
  public.finish_report(uuid, text, text, text[], text) from public, anon, authenticated;
revoke all on function public.can_write_business(uuid) from public, anon;
grant execute on function public.can_write_business(uuid) to authenticated;
-- The recipients CHECK runs as the writer, so the service role needs the private schema too.
grant usage on schema private to service_role;
revoke all on function private.valid_recipients(text[]) from public;
grant execute on function private.valid_recipients(text[]) to authenticated, service_role;
