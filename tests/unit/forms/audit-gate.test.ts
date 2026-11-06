import { describe, expect, it } from "vitest";
import { auditGate } from "@/components/forms/audit-gate";
import { formCopy as c } from "@/components/forms/copy";

// Founder-approved (07:56 UTC): Turnstile stays hidden until the email and the domain are both valid,
// then fades in. "Get my free audit" is inactive (aria-disabled + helper) until a token arrives.
const step = (valid: boolean, revealed: boolean, token: boolean, widget: "on" | "off" = "on") =>
  auditGate({ valid, revealed, token, widget });

describe("auditGate", () => {
  it("empty or partial: hidden, inactive, 'Enter your email and website to continue'", () => {
    expect(step(false, false, false)).toEqual({ reveal: false, ready: false, helper: c.auditHelperFill });
    expect(c.auditHelperFill).toBe("Enter your email and website to continue");
  });

  it("both valid, no token yet: the widget shows, still inactive, 'Check the box to continue'", () => {
    expect(step(true, false, false)).toEqual({ reveal: true, ready: false, helper: c.auditHelperCheck });
    expect(c.auditHelperCheck).toBe("Check the box to continue");
  });

  it("a token: active, and the helper is gone (also how an invisible managed pass ends)", () => {
    expect(step(true, true, true)).toEqual({ reveal: true, ready: true, helper: null });
  });

  it("editing back to invalid: inactive again; the widget stays revealed (and its token is kept)", () => {
    expect(step(false, true, true)).toEqual({ reveal: true, ready: false, helper: c.auditHelperFill });
  });

  it("no widget (no site key, or Turnstile blocked): the old fallback, active once the fields are valid", () => {
    expect(step(false, false, false, "off")).toEqual({ reveal: false, ready: false, helper: c.auditHelperFill });
    expect(step(true, false, false, "off")).toEqual({ reveal: false, ready: true, helper: null });
  });
});
