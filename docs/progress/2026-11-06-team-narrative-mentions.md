## C-c PR 3 (frontend): the team sets a DFY client's narrative words and decides its mention lists (branch feat/team-narrative-mentions)

- Lead OK 2026-11-06 for C-c D3/D4. Q6 is O1: a client-switcher row beside Connections. No backend change: set_narrative_words, set_mention_target and upsert_mention_fix already allow the team on DFY clients (can_write_business).
- D3, behind ENABLE_NARRATIVE:
  - The switcher row and the document both read "How AI describes {Business}" (lead-approved, in COPY.md), because in the team view "you" would mean the team.
  - The document is G4's editor with the Settings-only lines (too few, no clash). It's one NarrativeSettings component, shared with /app Settings.
  - The editor keeps the client's own labels: "Words that fit you" and "Words to avoid".
  - Saves go through saveTeamNarrativeWords(businessId, words).
- D4, behind ENABLE_MENTIONS:
  - G7's MentionsSection is the first thing on the client's Sources document, as a level-3 section under the document title. The team can decide (canDecide).
  - Decisions go through decideTeamMention(businessId, url, status).
  - "View" opens the team's Fixes document. It never goes to /app/fixes, which would be the team member's own business.
- The team actions are public endpoints. Each one checks:
  - that the business is a DFY client the caller can read,
  - the feature's flag,
  - the input, with the same rules as /app (now shared: lib/narrative/input.ts, lib/mentions/input.ts).
  - Errors come back as codes, never raw text. On success they revalidate /team.
- Mention titles, categories, domains and the "Not relevant ({n})" count are marked data-computed, because they're data and not copy. The team-workspace COPY check caught this.
- /dev/team Example data has both the narrative and the mention lists. Shots: docs/qa/team-narrative-*.png and docs/qa/team-mentions-*.png.
