# G7 (backend): mention target decisions (branch feat/mention-decisions)
- GAS brief, lead decisions 2026-11-06 (G7 note OK): candidates ("Lists that name your rivals but not you") are computed on read by data-pipeline from the latest run's stored citations; only users' decisions are stored. U7: "Add to fixes" feeds ONE grouped P3 fix. Behind ENABLE_MENTIONS.
- Migration 20261105000030 (+ .down.sql), additive: mention_target_decisions (business, url http/https ≤ 2000, status added|dismissed, decided_by, decided_at; pk business+url). Read: members incl. the dfy_client and the team on DFY. set_mention_target(business, url, status|null) (definer, can_write_business; never a dfy_client) sets, replaces or clears.
- Fix rule R17 "Get on these lists" (p3; customer copy from the prototype's grouped fix), enabled. The key check widens to R17 and 0024's pillar map gains it. Like R16 it comes from the migration, so the seed generator skips it; the fresh-reset test expects 24 rules with R17 enabled. SCHEMA 5b row, COPY.md GAS entry, AEO.md R1-R17.
- Queries: src/lib/queries/mentions.ts (listMentionDecisions, setMentionTarget).

