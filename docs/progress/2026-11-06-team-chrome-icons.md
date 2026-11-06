# DQ8 + DQ9: one icon set and one accent in the /team chrome (design-quality, branch polish/team-chrome-icons)

Audit: share/design-quality/AUDIT.md DQ8, DQ9.

- The client switcher caret was a "▾" text glyph: it sat on the text baseline beside 16px stroke icons. It is now the drawn `chevronDown` icon (added to Icon.tsx), 14px, muted, with a 6px gap.
- The doc tab, Recents and Context file icons and the client avatar were amber/warn. UI.md: amber is a state colour, one accent. They are now muted icons and a neutral `overlay` avatar.
- Tests: client-switcher.test.tsx (no glyph, drawn chevron, neutral avatar) and v3-drift.test.tsx (no amber in src/components/workspace). Both failed first.
- Left for the implementer's control-shape PR: BusinessSwitcher's "▾" (billing/BusinessSwitcher.tsx:104). It is also inside the button's accessible name ("Example Ramen House ▾"), which tests pin.
