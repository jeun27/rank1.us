# DQ7: motion tokens and one easing curve (design-quality, branch polish/motion-tokens)

Audit: share/design-quality/AUDIT.md DQ7. UI.md already named one curve, cubic-bezier(.16,1,.3,1), but nothing defined it, so every transition used Tailwind's default ease and the timings were one-offs (100, 150, 200, 300ms).

- globals.css @theme: `--ease-out` is the UI.md curve, and it is the default timing function for every transition (150ms default). The `ease-out` utility now means this curve, so the audit form reveal and the fade-in pick it up with no class change.
- Removed the one-offs: Button and AuroraButton press 100ms (below the 120ms floor) → the 150ms default; the inline curve on the landing demo row → `ease-out` (its 300ms stays: it is the one focal moment).
- The text-action arrow is 14px (UI.md: 12–14px; it was 16).
- tests/unit/tokens.test.ts pins the tokens and fails on any inline curve or a duration under 120ms outside the landing demo.
- Not changed: hover colours still switch instantly (lead Q5). The audit form reveal still animates grid rows, a layout property; it is listed for a later PR.
