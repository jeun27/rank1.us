## One points formatter and one delta tone everywhere (lead, after #126; branch fix/ui-one-delta-format)

- #126 left four more copies of the "+n pts" formatter (AuditView `points`, HistoryView, `context.ts` `pointsChange` and its competitor line, /dev/ui example data), most with a hyphen minus, and the /team Summary delta was still an info-blue tag.
- All of them call `signedPts` (lib/metrics/delta, real minus). `context.ts` exposes `pointsDelta` (the number) next to `pointsChange` (its display form). The /team Summary badge uses `deltaTone` + `mono`, like /app and /client.
- The report PDF and the /team brief now print "−3 pts" (real minus) instead of "-3 pts". percent-floors.test updated for that.
- Guard: tests/unit/metrics/one-delta.test.tsx fails if any other source file builds a "… pts" string.
