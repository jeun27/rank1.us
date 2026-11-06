## Sources leads with what to act on (UX X11, plan PR 22, branch feat/app-sources-order)

- Sources opened with the patterns, a block-sized location form and four per-engine bar cards. The table that says where to get listed (top domains) came last.
- New order: one toolbar row (freshness line + a compact location filter: label, select and Show inline) → the G7 slot (comment marker for frontend's "lists that name rivals" table) → top domains → legend + per-engine bars.
- Not done from the plan: X32 "apply on change, Show only without JS". LocationSelect deliberately submits only on Show (QA #49), because submitting on change reloads the page on every arrow key (WCAG 3.2.2 On Input). Show stays.
- Follow-up once #130 merges: pass `stack` to the top domains Table (it's cramped at 375).
