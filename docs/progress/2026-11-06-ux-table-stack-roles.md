## Stacked tables keep explicit table roles (reviewer S1 on #130, branch fix/ui-table-stack-roles)

- #130's stacked phone layout sets display grid/flex on tr/tbody. Chromium keeps the table semantics (the reviewer checked), but Safari/VoiceOver can drop them.
- With `stack`, Table now states its roles: table, rowgroup (thead/tbody), row, columnheader, cell. Plain tables are unchanged. The cells' column headers still resolve (unit test).
