# UX PR 12: start a test in steps (X22)

- `ExperimentForm`: test questions first. Control is derived (every question that isn't a test question, minus the ones dropped with Edit), so a question can't be in both groups and unticking a test question puts it back in control.
- "Control: the other {n} questions" (n=1 "the other question") + Edit (aria-expanded/aria-controls) opens the control list. That list never offers a test question.
- Start a test is disabled until 1+ test question and a non-blank name, with "Pick at least one test question and a name." tied via aria-describedby. The name is controlled now (prefilled from the fix).
- Obsolete: `experimentCopy.errors.test` ("Pick at least 1 test question.") can't show any more. Left in place pending the lead's OK to delete.
