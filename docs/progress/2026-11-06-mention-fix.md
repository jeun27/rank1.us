# G7 grouped mentions fix (backend) (branch feat/mention-fix)
- Lead (2026-11-06): one grouped R17 fix ("Get on these lists") from the business's 'added' mention decisions. With none added, the open (todo/doing) R17 is deleted (lead Q1); a done R17 is left alone.
- Migration 20261105000033 (+ .down.sql): upsert_mention_fix(business, detail) (invoker, so the fixes RLS applies; checks can_write_business, never a dfy_client). It updates the one open R17 or inserts it as todo, with evidence {urls: newest first}, detail = data-pipeline's filled copy (1–2000 chars, 22023), title/size from the rule. Idempotent.
- No duplicate with the weekly pass: record_fix_results updates an existing open fix of a rule, and the unique open-fix index allows one. data-pipeline doesn't send R17 in that pass.
- Query: upsertMentionFix(db, businessId, detail) in src/lib/queries/mentions.ts.
- Reviewer: the upsert is one insert … on conflict on the open-fix unique index, so concurrent first calls can't raise 23505 (tested with 5 parallel calls); a disabled or missing R17 raises 22023 mention_rule_unavailable.
