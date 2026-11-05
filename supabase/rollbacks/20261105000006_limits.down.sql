-- Reverts 20261105000006_limits.sql
drop trigger if exists businesses_seat_limit on public.businesses;
drop trigger if exists questions_active_limit on public.questions;
drop function if exists private.enforce_business_seats();
drop function if exists private.enforce_active_question_limit();
