import { formCopy as c } from "./copy";

// The audit form's Turnstile gate (founder-approved 2026-11-06). The widget is revealed once the email and
// domain are both valid and stays revealed. The button is ready with valid fields and a token. Without a
// widget (no site key, or the script is blocked) it's the old fallback: ready once valid, and the server
// still verifies the token.
export type Gate = { reveal: boolean; ready: boolean; helper: string | null };

export function auditGate({
  valid,
  revealed,
  token,
  widget,
}: {
  valid: boolean;
  revealed: boolean;
  token: boolean;
  widget: "on" | "off";
}): Gate {
  if (widget === "off") return { reveal: false, ready: valid, helper: valid ? null : c.auditHelperFill };
  return {
    reveal: valid || revealed,
    ready: valid && token,
    helper: !valid ? c.auditHelperFill : token ? null : c.auditHelperCheck,
  };
}
