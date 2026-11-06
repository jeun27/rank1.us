# UX PR 21: Reports status first, settings folded (X10, X28)

- Reports opens on "Next report {date} to {n} recipients." (saved recipients, so typing doesn't change it), then History. "Report preview" and "Branding" are `<details>` folds below. Branding starts open while no recipient is saved.
- `nextReportDate(now)` in `lib/reports/month.ts`: the 1st at 07:xx LA. Until 08:00 LA on the 1st it's still today's send, after that next month's. `shortDate` gives "Dec 1".
- The preview iframe mounts when its fold first opens, so the real PDF renders only on demand.
- Save is `alt` until a field differs from what's saved, then `primary`. After a save the recipients textarea shows the normalized list.
- Open: "Branding" label approval (Q3 to the lead).
