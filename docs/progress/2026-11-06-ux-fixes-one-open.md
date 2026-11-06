## Fix list: one fix open, the rest one line (UX X7, plan PR 7, branch feat/fixes-one-open)

- Every fix was a full card of equal weight (1843px at 1280 on the example), so picking the next one meant reading them all.
- On load only the first open fix (first non-empty pillar group, the Dashboard card's fix) is open. Other rows are one line: check-off (or the read-only mark), the title as a disclosure button (aria-expanded/aria-controls, chevron), and "{n} affected answers". Rows are 44px tall below md and 40px from md, with hairline dividers. Any number can be open (local state).
- An open row is the same card as before: detail, affected, in progress / done line, Start / Undo, the before/after link.
- Each row has `id="fix-{id}"`. A `#fix-{id}` hash on load opens that fix, scrolls it to the centre and focuses its title (the Dashboard card link, PR 6).
- x/s shortcuts still work on collapsed rows. Done rows start collapsed. Read-only (/client) can open rows too.
- Tests that read inside a non-first fix now open it first (checkoff.test, experiments-ui.test, checkoff.spec). That's the behaviour change, not a looser test.
