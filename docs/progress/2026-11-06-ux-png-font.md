## The PNG export uses Inter (UX F1b, branch feat/ui-png-font)

- F1's render pass found the audit PNG (`AuditImage` via next/og) set `fontFamily: "sans-serif"`, so it rendered in the renderer's default font, with weight 700 for the hero and "Competitors".
- `components/audit/fonts/` holds Inter latin 400 and 600 as woff (Satori can't read woff2), from @fontsource/inter 5.3.0, ~30 KB each, with the OFL licence. `respond.ts` reads them (`PNG_FONTS`) and passes them to ImageResponse. AuditImage uses `fontFamily: "Inter"` and 600 instead of 700.
- next.config `outputFileTracingIncludes` adds the files to both PNG routes (`/audit/[token]/export.png`, `/app/runs/[runId]/export.png`). Checked in the build's .nft.json for both. The DB e2e downloads a real PNG (audit-db.spec, 200 image/png).
