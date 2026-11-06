## G5 (frontend): pillar groups in the Fix list (branch feat/fix-pillar-groups)

- Lead OK 2026-11-06 (straight to it, the slot was approved). A new PR on #107's FixList, merging after #107.
- With pillars (every real fix since #102): groups in the order P5 → P3 → P2 → P1 → P4 → P6, each with a "P5"-style tag, the brief's label and "{done}/{total}" (open + done with that pillar). Empty groups are hidden. Tidy-ups sit last inside P2. P0 is one baseline line at the bottom, not fixes: "Your baseline: {pct} visibility, named in {n} of {d} answers." from the latest run, linking to the dashboard; hidden without a run. Without pillars (older fixtures) the plain sections stay.
- Open (lead Q4): done_fixes has no pillar yet, so a done fix counts toward its group only once backend adds it. DoneView.pillar is optional until then.
