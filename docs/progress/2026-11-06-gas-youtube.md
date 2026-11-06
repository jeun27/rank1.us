# G1 YouTube, read-only (data-pipeline, branch feat/gas-youtube)

Built from briefs/rank1-gas.md (G1) + the lead's OK on the design note (2026-11-06). Rides ENABLE_CONNECTIONS. Fixtures only, no live calls. The founder adds youtube.readonly to the Google verification.

## Lead decisions (2026-11-06)
- One keyword per business = its category term from its questions (businesses.cuisine, the {cuisine} slot). The city is only an optional hint. No cuisine = "no keyword", never a guess.
- Chapters only matter on videos of 5 minutes or more (contentDetails.duration). Shorter videos show "Not needed".
- "Says the keyword" stays "Can't check": captions need more than youtube.readonly.
- The grant is incremental on the same Google client, and revoke is grant-wide. Frontend's Disconnect copy for YouTube needs the "this disconnects all Google services" wording.

## Changed
- src/lib/connections/youtube.ts: channels.list (mine), the newest 50 uploads (playlistItems), one videos.list (snippet,contentDetails). 1 quota unit each.
- src/lib/metrics/youtube-checks.ts: parseDuration (ISO 8601); hasChapters (YouTube's rules: the first at 0:00, ≥3 ascending, each ≥10 s); checkVideo (keyword in the title and in the first 2 description lines, with G4's word rule via the new hasWord export).
- OAuth: OAUTH_SCOPES = the hub's GOOGLE_SCOPES + youtube (youtube.readonly). It's kept apart from GoogleConnector so frontend's hub/consent copy maps don't change until their YouTube tile ships. The start route accepts youtube.
- The OAuth start refuses (400) any connector not in LIVE_CONNECTORS (lead, #146 S1), so YouTube can't be connected until frontend's tile ships. No keyword: the tile shows "Add your main keyword to check your videos." (frontend). A real keyword for non-restaurant verticals waits on the founder's question-templates decision.
- The picker lists the owner's channels. loadYoutubeChecklist(ctx, connectionId) serves the checklist page (members incl. the dfy_client, and the team on DFY). youtubeChecklistForBusiness serves the fix pass.
- Fix pass: R19/R20/R21 (backend 0035, p4) are one grouped fix per rule. Evidence = the failing videos {id, title, url}, plural copy comes from the row and the one-video forms from COPY.md (backend's spec). ok when every relevant video passes (short videos never count for R21). Review of #146 (lead): R19–R21 apply only with an active YouTube connection, a chosen channel and a keyword (youtubeReady). Otherwise they get no rows at all, so nothing noisy reaches the Fix list. A new cron hook, applicable(run, rules), narrows the rules per run, so the unchecked fallbacks add none either. A connected channel whose read fails → unchecked with the reason; no videos → unchecked (no_videos).
- Test change, with reason: rules.test.ts finds a migration row by its last "('R19', " (0035 inserts several rows in one statement, and the pillar mapping mentions the keys first).

## Open
- LIVE_CONNECTORS still excludes youtube. Frontend adds the tile + consent, then flips it. Going live adds YouTube to saas/dtc readiness (Recommended ∩ live), so those businesses would need YouTube connected to be "Ready for GAS". Lead to confirm.
- The R19–R21 copy is pending the lead's approval in backend's #137.
