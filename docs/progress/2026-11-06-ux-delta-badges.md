## Mono delta badges in state colours (UX X1 / S2, branch feat/ui-delta-badges)

- The hero delta ('+3 pts') on /app and /client rendered as an info-blue Inter tag. R2 keeps info blue for You, info and focus, and UI.md says deltas are mono.
- `Badge` takes `mono` (font-mono, -0.03em). `lib/metrics/delta.ts` holds `signedPts` (moved from ExperimentList, real minus sign) and `deltaTone` (+ success, − error, 0 neutral). Dashboard and ClientDashboard heroes use both.
- Leftover copies of the points formatter, not touched here: `audit/AuditView.tsx` `points`, `app/HistoryView.tsx`, `lib/workspace/context.ts` `pointsChange` (hyphen minus, asserted by percent-floors.test), and `workspace/Docs.tsx` Summary still shows its delta in info blue on /team.
