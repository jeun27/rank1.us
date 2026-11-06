## /client: what the team did, first (UX X3, plan PR 18, branch feat/client-team-did-first)

- A DFY client opened on the same blocks as an owner, with the team's work only inside the full Fix list at the very bottom, and History listed every check.
- Slot 2 is now "What the team did": fixes in progress, then done (newest first), each with the status mark and "In progress · Rank1 team · Nov 5" / "Done Nov 4 · Ana" (`statusLine`, exported from FixList so both use one wording). Read-only, and only when the team shows fixes and one is in progress or done. The C-b/G3 card follows it (slot 3), then the chart, engines, competitors, History and the open Fix list.
- History shows the last 4 checks (founder OK). There's no /client history page, so nothing links to older rows. That page would be a separate decision.
- Pushback on the plan: ClientDashboard is kept rather than replaced by `Dashboard viewer="client"`. The two differ in data and behaviour (billing, the next-fix link, the history shape), so one component would need client/owner branches throughout.
- COPY.md "UX (lead, 2026-11-06)": "What the team did".
