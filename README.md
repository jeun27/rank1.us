# rank1.us

Rank1: Be the brand AI names first.
Rank1 checks whether AI answer engines name a business when people ask buying questions.
Next.js on Vercel, Supabase, Stripe. Product, data and design rules: docs/PRODUCT.md.

```bash
pnpm install
pnpm dev               # http://localhost:3000
pnpm typecheck && pnpm lint && pnpm format:check
pnpm test              # unit (Vitest)
pnpm exec supabase start && pnpm test:db   # DB tests against local Supabase
pnpm e2e               # Playwright
```

## Working Guidelines

These are the house rules for people and agents. AGENTS.md and CLAUDE.md point here.
Product, data and design rules live in docs/PRODUCT.md (moved word for word from CLAUDE.md).

1. **Issue first** for anything bigger than a small fix. The PR links it.
2. **Ready PRs, not drafts.** Title: `type(area): what changed`, for example
   `fix(contact): reject Other text over 60 characters`. Types: feat, fix, refactor, test, docs, chore.
3. **Sign off every commit** with `git commit -s`. CI checks every commit in the PR.
4. **CI must pass:** typecheck, tests (unit + DB), lint and format. Merging also needs 1 approving review.
5. **Say why.** The PR explains why the problem exists, not only what changed. If both adding
   and removing code were options, say why removing didn't work.
6. **Tests that would have caught the bug.** Write the test first and show it failing before
   the fix. No coverage padding. Never delete, skip or loosen a test to get green.
7. **UI changes** get a "Visuals for <sha>" PR comment: light theme, fake data, the app page
   only, phone + desktop, and the sha of the newest commit. New pushes get new visuals.
8. **Comments are at most 3 lines in a row.** History belongs in the PR, not in the code.
9. **Merged is not live.** Releases are tagged and deployed only on request.
10. **Notes in their own files.** Feature PRs add a note file docs/progress/<date>-<slug>.md (and
    docs/handoff/<date>-<slug>.md for interface notes) instead of editing PROGRESS.md/HANDOFF.md; the lead folds them in.

## Releasing

Merging to main does not deploy. Production deploys happen only when Jeun says "release".

1. Tag `vX.Y.Z` on main, annotated, with the changelog = merged PR titles since the last tag.
2. Push the tag.
3. Lead only: apply missing migrations to the hosted DB first (every `supabase/migrations` file newer than the hosted one, in order), then run `notify pgrst, 'reload schema'` so the API sees the new objects.
4. Lead only: from a clean checkout of that exact tag (a fresh clone or `git worktree add` at the tag, no local changes, then `pnpm install --frozen-lockfile`), run `vercel deploy --prod`.
5. Post the included PRs to Jeun.
