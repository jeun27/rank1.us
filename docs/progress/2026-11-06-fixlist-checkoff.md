## Portal (b) (frontend): check-off Fix list (branch feat/fixlist-checkoff)

- Lead OK 2026-11-06 (mockup fixes-mock.html). Built on backend #101 (fix status history: status_changed_at / status_changed_by, listDoneFixes with changed_by {is_team, name}), now on main.
- The Status select is gone. Each fix has a circle that is a real checkbox (role checkbox, named by the fix title, aria-checked false / mixed / true, aria-keyshortcuts x, tooltip "Mark done (x)"). Click or x = done, with a toast "Marked “{title}” done" + Undo (back to the previous status). "Start" (To do only, s, "Start (s)") sets doing: a half circle + "In progress" + who · date. Done rows are struck through with "Done {date}" · who + Undo (reopens to To do). The DB keeps todo / doing / done via set_fix_status.
- Who: "Rank1 team" for a team actor, the member's name otherwise, never an email; none when the weekly check closed it (changed_by null).
- "{done} of {total} done" bar and an Open / Done / All filter. The filter is a segmented control (radiogroup, arrow keys), not tabs, because the team workspace already wraps the list in a document tabpanel.
- Groups: today's sections (the ranked list, Tidy-ups with its count). The pillar tag slot is empty until G5 (#102).
- No legend line (lead): the shortcuts live in the tooltips and aria-keyshortcuts.
- dfy_client: the circles are status images (role img, "{title}: {status}"), no Start or Undo.
- /app/fixes, /client and /team load listDoneFixes next to listFixes.
- Who/when on in-progress rows (lead Q3): from backend #108, which adds status_changed_at + changed_by to listFixes items (doing rows; null on todo).
