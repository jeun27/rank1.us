## One name and one rail order everywhere (UX X16, plan PR 15, branch feat/app-one-name-order)

- /team called the fixes page "Fix list" and ordered its rail Dashboard · Questions · Competitors…, while /app says "What to fix next" with Competitors before Questions. The Context panel also opened by default beside the document, so /team had two focal panels.
- `SECTION_LABEL.fixes` = "What to fix next" (lead: the one name). `SECTIONS` follows the /app order: Dashboard · Competitors · Questions · Sources · What to fix next · Experiments · Reports · History · Settings (the /team rail still hides Experiments, Reports and Settings).
- Context starts closed. The D21 top-bar toggle opens it, and nothing is persisted.
- COPY.md: new "UX (lead, 2026-11-06)" section with the X16 row.
- Tests: team-workspace/team-shell expect the new order, the name and a closed Context. The e2e `show(page, "Context")` helper opens the panel on desktop too, so tests that need Context say so. Rail label at 1280 checked: not truncated.
