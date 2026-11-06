# G4 narrative word match (data-pipeline, branch feat/gas-narrative)

Built from briefs/rank1-gas.md (G4) + the lead's OK on the design note (2026-11-06). Behind ENABLE_NARRATIVE. No LLM; nothing is stored (backend 0028 stores only the word lists).

## Changed
- src/lib/metrics/narrative.ts, a pure matchNarrative({names, words, answers}).
  - n = counted answers (ok) that name the business and have text.
  - Only text within ±200 characters of the business name or an alias counts.
  - A word matches with s/es/er/est (lead U4), case-insensitive, as a whole word (letters/digits around it break the match). A phrase takes the ending on its last word, and regex characters are literal.
  - Per word: the number of answers ("in {k} answers" / "not yet"). clashes = answers with ≥1 avoid word.
  - The snippet is the first avoid hit, else the first want hit: ~160 characters cut on word boundaries with "…", plus [start, end) offsets for the highlight. The UI labels it as a word match.
  - tooFew when n < 10 (the existing "Too few answers to call yet. Next check Monday.").
- src/lib/narrative/service.ts: loadNarrative(db, b) reads, with the caller's client, the word lists (getNarrativeWords), the name + aliases, and the latest answer per question and engine (getQuestionsWithLatestAnswers, the Questions page's answers). result is null until there are words and a finished run.
- .env.example gets ENABLE_NARRATIVE=false.
