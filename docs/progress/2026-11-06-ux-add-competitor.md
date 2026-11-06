## Add a competitor when it's relevant (UX X26, plan PR 10, branch feat/app-add-competitor-when-relevant)

- The manual add form was always open under the leaderboard and the suggestions, even when the business already tracks competitors and suggestions offer one-click adds. An empty submit did nothing visible.
- With competitors tracked, the form sits behind an "Add competitor" text action (`<details>`, the existing string). With none yet it stays open, as the next step.
- Add stays enabled. An empty submit puts the cursor in Name. There's no existing inline error string for an empty competitor name, so this adds no new copy (the planner's "existing error" note assumed one).
