# G7 follow-up: one load per page render (data-pipeline, branch fix/mentions-one-load)

Review of #131 (lead, non-blocking): each add/not-relevant click read up to 8 runs.

- loadMentions reads once per page render: the run list (8 back), the decisions, the latest run, and older runs only for added lists that aren't in it. It returns a MentionsView: the lists split by decision, every added URL, and each added list's last known version (its rivals).
- decideMention(db, b, url, status, view) takes that view, so a decision is two writes (set_mention_target, upsert_mention_fix) and no reads. The caller revalidates the page after.
- The rules for R17's detail are unchanged (rivals only from the added lists' own stored evidence; the no-names copy when none are known).
- Test changes, with reason (API change requested by the lead): the decide tests pass the loaded view, and loadMentions now asks for 8 runs. New tests count the queries: a render makes 1 run list + 1 decisions read + only the run reads it needs; a decision makes 0 reads and 2 writes.
