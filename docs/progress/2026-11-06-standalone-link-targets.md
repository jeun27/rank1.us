## QA v0.8.0 (#179) FAIL (frontend): 44px targets for standalone text links (branch fix/standalone-link-targets)

- The QA finding: at 375, in both themes, standalone text links rendered 19px tall:
  - "Skip for now" (ConnectCard, onboarding)
  - "Edit words" (the /app narrative clash card)
  - the R17 evidence links and "+{n} more" (fixes-mentions)
  - the R19–R21 video links (fixes-youtube)
- There was no shared style, so I added one: `linkTarget` in src/components/ui/link.ts (inline-flex min-h-11 items-center md:min-h-8, WordsEditor's pattern). It's applied where those links are defined:
  - ConnectCard's link style: "Skip for now", plus its all-set fix-list link
  - NarrativeDashboard's "Edit words"
  - MentionsSection's PageLink (the R17 evidence and the Sources rows) and "+{n} more"
  - YoutubeFixEvidence's video link
- Links inside a sentence stay exempt, such as the no-words line's "Add your words".
- The new-tab links wrap their text in one span, so the space before the screen-reader "(opens in a new tab)" stays in the link's name under flex.
- Test: tests/e2e/link-targets.spec.ts. At 375, in both themes, each of those links has a box at least 44px tall.
- Shots: docs/qa/links-*.png.
