## v0.8.0 blocker (frontend): load the /team client queue in one call (branch fix/team-queue-one-call)

- Lead, 2026-11-06. #161's loadQueue made 5 PostgREST calls per DFY client (run summaries, fixes, done fixes, gas ready, connections). At about 120 clients Kong ran out of connections and /team failed.
- Reproduced on the local stack with 150 seeded DFY clients. /team answered 200, because it streams, and then showed "This page couldn't load". The server log showed `fetch failed: other side closed (UND_ERR_SOCKET)`.
- loadQueue(db) now makes one call, listTeamClientQueue (team_client_queue(), #169 / 0038). queueRowFromRpc maps each row per backend's handoff:
  - visibility = named/n (null with no complete or partial run), delta, open = open_fixes
  - the tag = queueTag({ lastRunFailed, connections: needs_reauth ? ["needs_reauth"] : [], gasReady, started })
  - queueTag and sortQueue are unchanged. The tag is still null without ENABLE_CONNECTIONS.
- Tests:
  - Unit: tests/unit/team/queue-rpc.test.ts covers the mapping and every tag. With 150 rows it checks for one RPC call and no per-client reads.
  - e2e: tests/e2e/team-queue-scale.spec.ts seeds 150 DFY clients. It checks that /team is 200, has no error page, and lists all 150. It needs the local Supabase stack, like team-real, and it archives its seeded clients afterwards.
- Shots of the real /team queue: docs/qa/team-queue-150-*.png.
