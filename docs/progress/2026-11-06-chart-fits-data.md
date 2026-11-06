# DQ5: the Dashboard chart fits its data (design-quality, branch refactor/chart-fits-data)

Audit: share/design-quality/AUDIT.md DQ5. The y axis was fixed at 0–100% while the Example data sits at 18–33%, so about 60% of the plot was empty. The SVG height scaled with its width: 340px at 1280, about 90px at 375. The UI.md direct endpoint label was missing.

- The y axis starts at 0 (a change is never overstated) and tops out at the smallest of 20/40/60/80/100% that holds the highest point. The 3 ticks are 0, half and top.
- Fixed height: 160px, 200px from md. The SVG stretches (`preserveAspectRatio="none"`, non-scaling strokes). The dots are HTML, so they stay round, and the axis labels were already HTML (X9b).
- The last point is labelled directly with its % in mono (UI.md Chart).
- tests/unit/app/visibility-axis.test.tsx: the axis ticks for the Example (0/20/40) and the domain rule for three highs, the fixed height and the end label. They failed first. UI.md's Chart row has the rule.
