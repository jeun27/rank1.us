# G7 follow-up: one read per request (data-pipeline, branch fix/mentions-one-load)

Reviews of #131 (each click read up to 8 runs) and #143 (B1, B2).

- One shared readTargets per request: the run list (8 back), the latest run, and older runs only for added lists missing from it. loadMentions uses it once per page render, and its return shape is unchanged (MentionTargets).
- decideMention(db, b, url, status) keeps #142's action signature (B2: no view or copy from the client). It saves the decision, re-reads the decisions once (B1: R17's n always equals the stored added count, even after two quick clicks or a change from another tab), reads the targets once, and upserts R17.
- R17's rules are unchanged: rivals only from the added lists' own stored evidence, and the no-names copy when none are known.
- Test changes, with reason (the lead's review): the query-count tests now pin the decision's order (save → decisions → targets → upsert), and a stored-state fake proves n matches the stored added count.
