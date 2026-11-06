## Offer the before/after test when a fix is done (UX X27, plan PR 8, branch feat/fixes-test-when-done)

- "Start a before/after test" sat on every open fix, offered before anything had changed.
- It now appears where a test makes sense: in the "Marked … done" toast (next to Undo) and on done rows, owners only (`canWrite`). The href keeps `?fix={id}` for the form's prefill (PR 12).
- On phones the toast puts the message on its own line, with the link and Undo under it.
- Left over (not in the plan): after marking the open fix done, the next fix doesn't open by itself.
- Review follow-up (WCAG 2.2.1): focus or hover on the toast pauses its 8 s timer, and leaving restarts the full 8 s. A Close button (×, "Close") closes it and moves focus to the list's first check-off, never the body.
