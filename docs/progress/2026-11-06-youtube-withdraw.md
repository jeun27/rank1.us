# G1 follow-up: withdraw stale YouTube fixes (data-pipeline, branch fix/youtube-withdraw)

Review of #152 (S1, lead 2026-11-06): when a business stops being youtubeReady (disconnect, null keyword, no chosen channel), its open R19–R21 fixes must not linger with stale videos.

- There was no "no longer applies" path: record_fix_results 'ok' marks todo and doing as done (a claim they were fixed), and fixes.status is only todo/doing/done. The lead approved backend's withdraw_fixes (#157, 0037): service-only, R19–R21 only, deletes only status = 'todo', and writes no history row.
- The fix pass's applicable() hook calls withdrawFixes(db, b, the enabled R19–R21) whenever it drops them. doing/done fixes are kept, nothing is marked done, and a withdrawal error is logged with its code only and doesn't stop the pass. When the business is ready again, the next pass records R19–R21 and record_fix_results recreates them.
- R16–R18 are unchanged: their "ok → done" means the check now passes, which is a real resolution (lead).
