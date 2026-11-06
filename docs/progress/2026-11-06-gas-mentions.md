# G7 "Lists that name your rivals but not you" (data-pipeline, branch feat/gas-mentions-g7)

Built from briefs/rank1-gas.md (G7) + the lead's OK on the design note (2026-11-06). Behind ENABLE_MENTIONS.

## Lead decisions (2026-11-06)
- Candidates are computed on read from stored results; only decisions are stored (backend 0030).
- Q1 = O2: "Add to fixes" shows up at once. Backend's upsert_mention_fix (0033, #127) rebuilds the one open R17 fix from the added decisions on every decision. The weekly fix pass does not send R17: backend found its ok/fix would fight the users' decisions, so that commit was reverted on this branch.

## Changed
- src/lib/metrics/mentions.ts, a pure mentionTargets(results, decisions). It takes pages cited in counted answers (ok, question still exists) that name ≥1 competitor and not the business.
  - The business's own site (incl. subdomains) and competitors' own sites are excluded. URLs are normalised (normalizeUrl) and decisions are matched on the normalised URL.
  - Per page: rivals (most-named first), k of n answers, engines, and the category label. Sorted by k desc, then URL. Split into candidates / added / dismissed.
- r17Fill(added) → {n, rivals}: up to 3 rivals, those on the most added lists first (ties alphabetical), "A, B and C".
- src/lib/mentions/service.ts (server-only, the caller's client):
  - loadMentions(db, b) uses the latest complete/partial run.
  - decideMention(db, b, url, status|null) calls setMentionTarget, then upsertMentionFix with the R17 copy below. n = every added list. Rivals come only from the added lists' own stored evidence: the latest run that still cites each one, up to 8 runs back (lead, #131 S1). With no known rivals the copy drops the names ("1 list AI cites doesn't name you." / "{n} lists AI cite don't name you."), never the competitor list.
  - Errors keep their real cause (S2): 42501 → not_allowed (a dfy_client), setMentionTarget's 22023 → bad_url, upsert_mention_fix's 22023 → rule_unavailable (mention_rule_unavailable) or bad_detail. The UI shows its generic failure copy for those two.
- R17 copy is checked verbatim against migration 0030.

- R17 copy (lead, 2026-11-06): "1 list AI cites names {rivals} but not you." for one list, "{n} lists AI cite name {rivals} but not you." otherwise (COPY.md GAS). The detail is built in mentions/service.ts, so its test checks COPY.md. Test change, with reason: it used to check migration 0030's row, which still has the first wording; backend updates that row.
