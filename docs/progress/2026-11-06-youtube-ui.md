## G1 (frontend): the YouTube "Search-ready checklist" (branch feat/youtube-ui)

- Lead OK 2026-11-06. Q1: copy, with "Keyword in the first two lines". Q2: no keyword is plain text, with no action ("Edit your business" is a separate follow-up). Q3: the checklist is the P4 fix evidence, and the tile shows status only. Q4: it rides ENABLE_CONNECTIONS. Built on data-pipeline's #146 (loadYoutubeChecklist, VideoChecks).
- Live: "youtube" joins LIVE_CONNECTORS. Its tier comes from recommend.ts (lead: Optional for every vertical, which is data-pipeline's change in #146). Consent copy (youtube.readonly, read-only), "Choose channel", and Disconnect on every Google tile now reads "This disconnects every Google service Rank1 uses: Business Profile, Search Console, Analytics and YouTube."
- The tile shows "Connected · {n} videos checked" (loadHub's live read, nothing on a failure).
- The checklist (YoutubeChecklistPanel) is the evidence on open R19/R20/R21 rows (loadYoutubeEvidence reads only with the flag, an open P4 fix and a non-revoked connection).
  - "Keyword: {keyword} · {n} videos", then per video a safe new-tab link and the four checks as text plus tone: Yes / No / Not needed / Can't check / No keyword. The captions reason sits under the list.
  - No keyword: the plain line alone, never a list of "No keyword" cells (lead). No videos, no channel, reconnect (needs_reauth/revoked/not_connected → "Reconnect YouTube") and a try-again line for temporary failures.
- Suggest fix (copy-only): "{keyword} | {title}", "{keyword} at {business}: {line}" and "0:00 Intro" (chapters needs no keyword), each with Copy → Copied. "Apply in YouTube" is disabled with "Coming soon". No clicks create fixes.
- Lead C4/C5: "No YouTube channel on this Google account." and "We couldn't load your videos. Try again."
