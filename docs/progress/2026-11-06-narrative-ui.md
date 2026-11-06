## G4 (frontend): "How AI describes you" (branch feat/narrative-ui)

- Lead OK 2026-11-06. Q1: the copy, with the helper edit, and every count reads "in {n} of {d} answers". Q2: the Dashboard shows the card for a clash, one quiet line for no words, and nothing for no clash or too few. Q3: /client waits for C-c. Q4: /app/settings/narrative. Behind ENABLE_NARRATIVE. It's built on #134 (loadNarrative, setNarrativeWords), with no backend changes. A word match, never an LLM reading.
- Settings: /app/settings/narrative (WordsEditor).
  - "Words that fit you" and "Words to avoid", each a list with "Remove {word}" and an add field ("Add" or Enter).
  - The RPC's rules are checked inline: "Up to 8 words.", "2 to 40 characters.", "That word is in the other list." A repeat is ignored.
  - Per-word "in {n} of {d} answers" / "not yet", the never-come-up hint, and Save with an inline "Saved." / failure status.
  - The no-clash and too-few lines live here.
- The save action (settings/narrative/actions.ts, public) re-checks the lists, saves for the current business, maps errors to codes and revalidates /app and the page.
- Dashboard (/app): `loadDashboardNarrative` reads the word lists first and loads answers only with the flag on and a word saved (review S1). NarrativeDashboard sits in a `narrative` slot, after the C-b card and before the chart. A clash shows the card ("{n} of {d} answers use words you want to avoid: {words}", the snippet quoted with the word in a mark, "Word match", "Edit words"). No words shows one quiet line with "Add your words". Otherwise nothing.
- Gating: `settingsBlocked` in the proxy. /app/settings/narrative follows ENABLE_NARRATIVE, the /app/settings index opens with either flag, and the connections pages keep ENABLE_CONNECTIONS. The index lists the enabled sections, and goes straight to the one section when only one is on. The rail's Settings item shows with either flag.
- COPY.md: the G4 rows sit in the GAS section, so they don't collide with #142's new UX section. "Saved." reuses the existing "After saving" entry (lead C3).
