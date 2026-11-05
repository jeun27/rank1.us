# rank1.us
Rank1: Be the brand AI names first.

## Releasing

Merging to main does not deploy. Production deploys happen only when Jeun says "release".

1. Tag `vX.Y.Z` on main, annotated, with the changelog = merged PR titles since the last tag.
2. Push the tag.
3. Lead only: from a clean checkout of that exact tag, run `vercel deploy --prod`.
4. Post the included PRs to Jeun.
