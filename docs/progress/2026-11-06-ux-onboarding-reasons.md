# UX PR 26a: onboarding reason lines + 6px shapes (X24 rest, D35)

- PR 26 is split: 26a here (X24 reason lines on step 1/2 Next, D35 shapes). 26b (X23 step 3 one-line rows + sticky "{n} of {total} questions tracked") follows.
- Step 1 `missing`: the first empty of name → cuisine → city → state, shown in the Bar beside Next (`Reason`, aria-describedby). Step 2: "Finding places near you…" while `result` is null.
- `ghost` and `chip` use `rounded-control`. DomainField's pill is the shared audit field (frontend), not changed.
- "Copy context" (/team) gets no reason (§C: a client-mount guard, not a missing input).
