-- Reverts 20261105000018_stripe.sql (businesses already archived stay archived).
drop function if exists public.archive_scheduled_businesses();
drop function if exists public.cancel_business_removal(uuid);
drop function if exists public.schedule_business_removal(uuid, timestamptz);
drop function if exists public.record_stripe_event(text, text);
drop function if exists public.apply_stripe_subscription(jsonb);
drop function if exists private.archive_due_businesses(uuid);
alter table public.businesses drop column if exists archive_at;
alter table public.workspaces drop column if exists stripe_event_at, drop column if exists stripe_current_period_end;
