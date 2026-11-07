# DQ18 follow-up: one "answers" count per screen

Partial-run badges (Dashboard, client Dashboard, History) showed `jobs_ok of jobs_total`. `jobs_ok` counts
no_overview answers, but the % denominator leaves them out, so a partial run with no_overview answers
showed two different "answers" counts. The badges now use the % denominator (the n under the %) as the
received count, so `jobs_ok` is no longer shown anywhere. `exampleRun` takes a `noOverview` option and counts
jobs_ok the way `private.recompute_run` does. The fixtures (examplePartial, exampleRuns[1]) now have 5 failed
and 5 no_overview answers: jobs_ok 245, n 240.
