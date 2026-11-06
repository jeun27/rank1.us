## Audit form: Turnstile revealed when ready (frontend, branch feat/audit-turnstile-reveal)

- Founder-approved 07:56 UTC, lead spec. The widget stays collapsed (inert) until the email and domain both pass `validateAudit`, the server's validators. Then it fades in with a grid-rows ease, and not at all with reduced motion. It stays revealed afterwards.
- "Get my free audit" is aria-disabled, with a helper line under it (aria-describedby), until Turnstile's token arrives: "Enter your email and website to continue", then "Check the box to continue". The helper is gone once there's a token. An invisible managed pass just makes the button active.
  - Editing a field back to invalid makes the button inactive again and keeps the token.
  - An expired token resets the widget.
  - After a submit the token is spent, so the button waits for the new one.
- Fallback unchanged: no site key, or the script blocked, means the button works once the fields are valid, and the server still verifies the token. An inactive click (or Enter) with an invalid field still shows the field errors.
- The pure gate is src/components/forms/audit-gate.ts. Turnstile.tsx gains onToken / onUnavailable callbacks; ContactForm is unaffected.
- Fields (lead: "check against D44/R2"): PillField moves to the v3 field look. That means radius 6, page fill, a 1px inset edge (so the input is the full target), no shadow, 44px below md and 36px from md. The 16px-below-md text is the existing globals.css rule. It's shared with onboarding, contact, sign-in, ClientsPanel and CompetitorActions.
- e2e: the shared Turnstile stub now calls back with its token, and reset() issues a new one, like the real widget. audit-turnstile.spec uses the real script with Cloudflare's always-pass test key.
