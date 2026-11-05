-- Reverts 20261105000005_service_only.sql
drop table if exists public.stripe_events;
drop table if exists public.contact_requests;
drop table if exists public.leads;
drop table if exists public.google_tokens;
