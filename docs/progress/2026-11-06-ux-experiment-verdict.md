## Experiment verdict first, delete in place (UX X14 + X29, plan PR 11, branch feat/app-experiment-verdict)

- The card read name → table → verdict, so the answer ("Difference +7 pts · Directional") came last. "Delete test" was a bordered button beside "End test", with equal weight, and it opened a modal.
- Order inside the card: header → verdict line → table → actions. "Too few answers" is unchanged (the sentence, no table).
- "End test" stays the alt button. "Delete test" is a text action at the far right. It confirms in place: an error-tone group "Delete this test? Its results go too." with "Delete test" and "Cancel" (COPY.md row "Delete confirm", lead 2026-11-06). Focus goes to Cancel, and Cancel or Escape returns it to "Delete test". The billing Dialog is no longer used here.
- `experimentCopy.cancel` added ("Cancel", already in that COPY.md row).
- Review follow-up: the inline "Delete test" uses a new Button `danger` variant (errorBg fill, brick text, brick/40 edge; the error banner's AA tones), and focus still goes to Cancel. The verdict's delta is the #126 mono state badge (signedPts + deltaTone).
