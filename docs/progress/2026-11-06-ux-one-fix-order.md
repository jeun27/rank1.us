## One fix order for the Dashboard and the Fix list (UX X1a, branch fix/ui-one-fix-order)

- The Fix list showed fixes grouped by pillar (P5 → P3 → P2 → P1 → P4 → P6 → P0), but `openFixes` sorted by size only, so the Dashboard's "What to fix next" could lead with a small P3 fix while the Fix list led with a P5 blocker.
- `PILLAR_ORDER` moved from `fixes/FixList.tsx` to `lib/queries/fixes.ts`. `openFixes` sorts with `byPillarThenSize` (pillar, size, rule key), so `getTopFixes`, the Fix list, the report fix list and the /team context all read one order.
- The getTopFixes DB test now expects the pillar order (R14, R10, R1, R11 instead of R14, R1, R10, R11): a spec change, not a looser test.
