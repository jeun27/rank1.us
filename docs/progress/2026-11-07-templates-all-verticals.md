# Onboarding v2 DP3: templates for every business type + youtubeKeyword (data-pipeline, branch feat/templates-all-verticals)

Spec: share/ux-plan/onboarding-welcome/README.md §4 (Q10 + the YouTube keyword rule), lead answers 2026-11-07 (Q1–Q3).

- `src/lib/questions/templates.ts`: the 12 Q10 templates (sort 21–32) with `family` (local / dtc / saas; restaurant for the 20 existing ones) and `trades_only` (origin "Onboarding v2 Q10, trades only": hvac, plumbing, roofing, pest_control, auto). Short forms are founder-approved (P3). Long forms are lead-approved under P3, 2026-11-07. Both are in docs/UI.md and docs/COPY.md.
- New slots: {category} (businesses.category), {service} (one question per entry in businesses.services), {competitor} (`Picks.competitors`). A missing one-value slot skips the template instead of throwing. {area} only expands with areas, as before.
- `Business` gains optional vertical/category/services. With no vertical, a business counts as a restaurant, so existing callers are unchanged.
- `youtubeKeyword(business)`:
  - Local: the first service + city, or with no services the category + city.
  - Restaurant: "{cuisine} {city}".
  - saas/dtc: the category, with no city.
  - Null when there's nothing to build it from.
  - G1 (`loadYoutubeChecklist`, `youtubeReady`) now uses it in place of the bare cuisine.
- Q3: the keyword is computed and read-only on the G1 tile. An override waits for a businesses field (none in #199).
- Seed: supabase/seed.sql keeps the 20 restaurant rows (generator filters family = restaurant; seed.test compares those verbatim). The 12 Q10 rows come from backend's #210 (0045, which also widens question_templates.vertical). tests/db/seed.test.ts checks all 32, with vertical = family.
- Built on main after backend's BE3 (#207) and Q10 rows (#210) merged: the new templates use sorts 21–32, so their template_key ("{sort}|slot=value…") is unique without a prefix. `cardQuestions` now builds for every business type, and a db test runs Restaurant → Local service → Restaurant with the real templates.
