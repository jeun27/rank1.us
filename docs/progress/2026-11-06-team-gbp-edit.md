## C-c PR 2 (frontend): Edit Business Profile, preview then apply (branch feat/team-gbp-edit)

- Lead OK 2026-11-06 (C-c D2). Q3: v1 is only description, website and primary phone. Behind ENABLE_CONNECTIONS. Production GBP edits also wait on Google's GBP API access approval (the founder's A2 form).
- The team's Connections document: the Business Profile row (connected, with a chosen location) offers "Edit Business Profile", which opens GbpEditor in place.
  - A location picker (the chosen locations) and the three fields. Fields off the allowlist never render.
  - "Preview changes" runs the live diff (previewGbpEdit) and is the confirmation, with no modal. A non-empty diff lists Before / After per field and only then shows "Apply". An empty one says "No changes to apply.". Any edit after a preview takes Apply away until a new preview.
  - "Apply" applies exactly the previewed diff (applyGbpEdit). "stale" (Google changed it meanwhile) shows "Google changed this profile since your preview. Here's a fresh one." with the fresh diff. Success shows "Applied." and a failure "We couldn't apply that. Try again.".
- The team actions previewTeamGbpEdit / applyTeamGbpEdit (public endpoints): the flag, a DFY client the team can read, the business's connected GBP, only the three fields as strings (≤2000), and a location. The service re-checks access and the allowlist. Errors are codes, never raw text.
- A dfy_client never sees edit controls: the client's hub has no editor, preview or apply (tested). Editing lives only in the team document.
- "Location" is a new label, approved by the lead (2026-11-06).
