## /team opens on the client queue (UX X5, plan PR 19, branch feat/team-client-queue)

- /team opened on one client's Dashboard, so the team had to switch client by client to see who needed them.
- With no client picked (/team), the first document is "Clients": a queue of every DFY client above the existing invite panel. Rows: status tag (left) · business (opens /team?b=) · visibility % with n · change (mono state badge) · open fixes. That's ≤3 numbers. Picking a client (?b=) opens on its Dashboard as before.
- Tags are the lead-approved G3 team tags (planner 11:13, COPY.md GAS): Needs attention (a connection needs_reauth/revoked, or the last run failed; a partial run is not attention), Ready for GAS (gas_ready and no fix started), Waiting on client (not ready), In progress (ready and a fix doing/done; neutral tone, R2). Sort: that order, then open fixes descending, then name. With ENABLE_CONNECTIONS off: no tag column, sorted by open fixes.
- `lib/workspace/queue.ts` holds the rules (pure). `app/team/queue.ts` reads per client in parallel: runs (3, all statuses), open fixes, and with G3 done fixes, gas_ready and connections. That's 5 reads, not 3: "In progress" needs done fixes and "Needs attention" needs connections. DFY clients are hand-onboarded; the comment says to move to a view past ~25.
- Simplification: "a Recommended connection dropped" is read as any of the client's connections dropped, since `listDfyBusinesses` has no vertical for `readinessSet`.
- No run yet: "–" in the visibility cell rather than an X25 sentence (those are written for the owner or client, not the team).
- /dev/team?state=queue shows it with Example data. The plain gallery keeps the Dashboard first, so the existing /team specs still apply.
