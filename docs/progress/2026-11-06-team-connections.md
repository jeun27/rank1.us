## C-c PR 1 (frontend): the team's Connections document, with the G3 notice (branch feat/team-connections)

- Lead OK 2026-11-06 for the C-c note: D1 + the notice first, then D2 (GBP edits: 3 text fields), then D3/D4 (the DFY narrative and mentions panes). Q2: the notice lives only here, and the PR19 queue shows the tag. Behind ENABLE_CONNECTIONS. No provider calls: everything is stored data, read with the team's own session.
- /team: a "Connections" row in the client switcher (beside Clients) opens the client's Connections document (DocSel "connections").
  - G3 notice while gas_ready.show_notice: "{Business} is ready for GAS" / "{connections} connected {age} ago." (the connected ones), "Start on the fix list" (opens the Fixes document) and "Dismiss" (dismissTeamReady → dismiss_gas_ready). Dismiss is optimistic, and a failure brings the notice back with "We couldn't do that. Try again.".
  - One row per connection: status, chosen entities, and at most one task line. "Ask the client to reconnect {connection}" for needs_reauth. "Ask the client to choose their {locations|sites|properties}" when nothing is chosen (lead Q5 pending: only the client or owner can pick).
  - Notify-me interest: "Asked to hear about {connectors}".
  - The change log with values (team only): field, Before, After, "by Rank1 team" / "by {email}" (a client user's email, team UI only), and the date. It's a stacked list, because the document pane is narrow (axe: scrollable-region-focusable).
- COPY.md: C-c rows in the Connections section. G7's "## UX" heading is renamed "## G7 mentions", so there's one UX heading.
