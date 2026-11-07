-- Onboarding v2 Q10 (founder P3, lead-approved; DP3 with data-pipeline's #209): the 12 non-restaurant
-- question templates. vertical holds the template's family: restaurant, local (every other vertical),
-- dtc or saas. The seed keeps the 20 restaurant rows; this migration is the only source of these 12.
-- Must match TEMPLATES sort 21-32 in src/lib/questions/templates.ts. Additive. Re-runnable.
-- Rollback: supabase/rollbacks/20261105000045_q10_templates.down.sql

alter table public.question_templates drop constraint if exists question_templates_vertical_check;
alter table public.question_templates add constraint question_templates_vertical_check
  check (vertical in ('restaurant', 'local', 'dtc', 'saas'));

delete from public.question_templates where origin like 'Onboarding v2 Q10%';
insert into public.question_templates (vertical, short_form, long_form, slots, fixed_cuisine, fixed_city, origin, sort)
values
  ('local', 'best {category} in {city}',
   'I''m in {city}, {state} and need a {category} I can trust; who are the best options nearby, and what makes them stand out?',
   array['category', 'city', 'state']::text[], null, null, 'Onboarding v2 Q10', 21),
  ('local', '{service} in {city}',
   'I need {service} at my place in {city}, {state} this week; which local businesses do it well, at a fair price, and can come soon?',
   array['service', 'city', 'state']::text[], null, null, 'Onboarding v2 Q10', 22),
  ('local', 'emergency {category} near me in {city}',
   'It''s late and I have an emergency at home in {city}, {state}; which {category} can come out tonight, and who answers fast?',
   array['category', 'city', 'state']::text[], null, null, 'Onboarding v2 Q10, trades only', 23),
  ('local', 'affordable {service} in {city}',
   'I''m on a tight budget and need {service} in {city}, {state}; who does good work without overcharging, and what should I expect to pay?',
   array['service', 'city', 'state']::text[], null, null, 'Onboarding v2 Q10', 24),
  ('local', '{category} with good reviews in {city}',
   'Which {category} in {city}, {state} has the best recent reviews from real customers, and what do people say they do better?',
   array['category', 'city', 'state']::text[], null, null, 'Onboarding v2 Q10', 25),
  ('local', 'who does {service} near {area}',
   'I live near {area} in {city} and need {service}; which local businesses cover my area, and who would you call first and why?',
   array['service', 'area', 'city']::text[], null, null, 'Onboarding v2 Q10', 26),
  ('dtc', 'best {category} brands',
   'I''m shopping for {category} and want something that lasts; which brands are worth the money right now, and how do they differ?',
   array['category']::text[], null, null, 'Onboarding v2 Q10', 27),
  ('dtc', 'where to buy {service}',
   'Where can I buy {service} online from a brand I can trust, with fair shipping and easy returns if it doesn''t work out?',
   array['service']::text[], null, null, 'Onboarding v2 Q10', 28),
  ('dtc', '{category} brands like {competitor}',
   'I like {competitor} but want to try something similar; which other {category} brands are as good or better, and how do they compare?',
   array['category', 'competitor']::text[], null, null, 'Onboarding v2 Q10', 29),
  ('saas', 'best {category} software',
   'We''re a small team picking {category} software this month; which tools are best right now, and what is each one best at?',
   array['category']::text[], null, null, 'Onboarding v2 Q10', 30),
  ('saas', '{category} tools for small businesses',
   'I run a five-person business; which {category} tools are easy to set up, fairly priced and good enough to grow with?',
   array['category']::text[], null, null, 'Onboarding v2 Q10', 31),
  ('saas', 'alternatives to {competitor}',
   'We use {competitor} but it''s getting expensive and clunky; what are the best alternatives right now, and why switch?',
   array['competitor']::text[], null, null, 'Onboarding v2 Q10', 32)
;
