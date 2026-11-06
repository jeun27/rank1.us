# Change-log actors (backend) (branch feat/connection-change-actors)
- Lead-approved frontend spec for #160: connection_change_actors(business) → { change_id, actor_is_team }. Migration 20261105000039 (+ .down.sql): definer, gated exactly like connection_changes_read (members incl. the dfy_client, the team on DFY; others get no rows), like open_fix_actors (0026). Only the team flag; a removed user (no role row) is false. No names or emails.
- Query: listConnectionChangeActors(db, businessId) in src/lib/queries/connections.ts.
