# Pillar on done fixes (backend) (branch feat/done-fix-pillar)
- Lead (2026-11-06): done_fixes also returns pillar, so frontend's G5 per-group done counts are complete. Migration 20261105000029 (+ .down.sql) re-creates done_fixes with the extra column (a function's result columns can't change in place; drop + create in one transaction). listDoneFixes items gain pillar.

