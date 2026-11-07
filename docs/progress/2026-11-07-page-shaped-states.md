# DQ10 (part): a Dashboard skeleton shaped like success, and one "Try again"

Loading: the Dashboard skeleton was three equal 112px bars, so the page jumped when results arrived.
`DashboardSkeleton` now draws the success layout (hero 7/12 + next fix 5/12, the Visibility chart, the
Competitors table) at the measured sizes. `tests/e2e/page-shaped-states.spec.ts` checks every block lands
within 24px of its success counterpart at 375 and 1280.
Error: every ErrorState sentence ended "Try again." beside a "Try again" action. The sentence drops it.
Not in this PR: first-running progress ("n of 240 answers" + ETA) needs live run progress, the client
Dashboard and other pages keep the generic skeleton, and empty-state copy waits on the lead (Q codes).
