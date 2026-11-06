## Chart axis labels stay readable on phones (UX X9b, plan PR 14, branch fix/app-chart-axis-labels)

- VisibilityLine drew its axis labels as SVG `<text>` at 11 viewBox units, so they scaled with the chart: about 7px at 375 and 18px at 1280.
- The labels are now HTML at a fixed 10.5px mono (UI.md Chart): the y labels (0/50/100%) sit in a 36px column beside the SVG at the grid line heights, and the first and last dates are a row under it. All aria-hidden; the sr-only table still carries the numbers. The SVG draws only the grid, line and points, with 8-unit padding instead of 44/28.
