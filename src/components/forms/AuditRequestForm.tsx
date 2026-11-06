"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { validateAudit } from "@/lib/spam/validate";
import { auditGate } from "./audit-gate";
import { formCopy as c } from "./copy";
import { Honeypot } from "./Honeypot";
import { PillField } from "./PillField";
import { postForm } from "./postForm";
import { Turnstile } from "./Turnstile";

type Field = "email" | "domain";
type State =
  | { kind: "idle" | "submitting" }
  | { kind: "error"; fields: Field[]; banner?: string }
  | { kind: "success"; email: string };

const fieldError = { email: c.emailError, domain: c.domainError };

// Final CTA form (#audit). Sits on the ink band: labels and field errors take the band's text color.
// Turnstile (founder-approved 2026-11-06) is revealed once the email and domain are valid (the server's
// validators), and the button waits for its token: aria-disabled plus a helper line, never a silent disable.
export function AuditRequestForm() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [resets, setResets] = useState(0);
  const [valid, setValid] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [token, setToken] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const success = useRef<HTMLParagraphElement>(null);
  const helperId = useId();
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const gate = auditGate({ valid, revealed, token, widget: sitekey && !unavailable ? "on" : "off" });

  // Re-reads the real field values. Autofill can fill both fields without input events, so this also runs
  // on focus, blur, animationstart (globals.css flags autofilled inputs) and submit (#129 S1).
  function refresh(ok: boolean) {
    setValid(ok);
    if (ok) setRevealed(true);
  }
  const reread = () => form.current && refresh(validateAudit(Object.fromEntries(new FormData(form.current))).ok);
  useEffect(() => {
    const el = form.current;
    const onAutofill = () => el && refresh(validateAudit(Object.fromEntries(new FormData(el))).ok);
    el?.addEventListener("animationstart", onAutofill);
    return () => el?.removeEventListener("animationstart", onAutofill);
  }, [state.kind]);

  function showErrors(fields: Field[], banner?: string) {
    setState({ kind: "error", fields, banner });
    const first = fields[0];
    if (first) requestAnimationFrame(() => form.current?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus());
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const el = e.currentTarget;
    const check = validateAudit(Object.fromEntries(new FormData(el)));
    refresh(check.ok);
    if (!check.ok) return showErrors(check.errors);
    // Valid but no token yet: refresh() reveals Turnstile and the helper says "Check the box to continue".
    if (!gate.ready) return;
    setState({ kind: "submitting" });
    const res = await postForm("/api/audit/request", el);
    // The token is single-use: the widget resets and the button waits for a new one.
    setResets((n) => n + 1);
    setToken(false);
    if (res.status === 202) {
      setState({ kind: "success", email: check.data.email });
      requestAnimationFrame(() => success.current?.focus());
    } else if (res.status === 400) showErrors(res.errors.filter((f): f is Field => f === "email" || f === "domain"));
    else showErrors([], res.status === 429 ? c.auditTooMany : c.auditError);
  }

  if (state.kind === "success") {
    return (
      <p ref={success} tabIndex={-1} role="status" className="text-body-lg font-semibold outline-none">
        {c.auditSuccess(state.email)}
      </p>
    );
  }

  const errors = state.kind === "error" ? state.fields : [];
  const submitting = state.kind === "submitting";
  return (
    <form
      ref={form}
      noValidate
      onSubmit={onSubmit}
      onInput={reread}
      onFocus={reread}
      onBlur={reread}
      className="relative flex w-full max-w-160 flex-col gap-4"
      aria-busy={submitting || undefined}
    >
      {state.kind === "error" && state.banner && <Banner tone="error">{state.banner}</Banner>}
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <PillField
          label={c.emailLabel}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          spellCheck={false}
          error={errors.includes("email") ? fieldError.email : undefined}
          errorClassName="text-current"
          className="md:flex-1"
        />
        <PillField
          label={c.domainLabel}
          name="domain"
          type="text"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          icon="globe"
          placeholder={c.domainPlaceholder}
          error={errors.includes("domain") ? fieldError.domain : undefined}
          errorClassName="text-current"
          className="md:flex-1"
        />
      </div>
      <Honeypot />
      {sitekey && (
        // Collapsed until revealed, then a short fade and height ease (none with reduced motion).
        <div
          data-turnstile-reveal
          data-revealed={gate.reveal}
          inert={!gate.reveal}
          className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${gate.reveal ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
        >
          <div className="overflow-hidden">
            {gate.reveal && (
              <Turnstile
                resetSignal={resets}
                onToken={(t) => setToken(Boolean(t))}
                onUnavailable={() => setUnavailable(true)}
              />
            )}
          </div>
        </div>
      )}
      <div className="flex flex-col gap-2 md:items-start">
        <Button
          type="submit"
          variant="final"
          loading={submitting}
          aria-disabled={!gate.ready || undefined}
          aria-describedby={gate.helper ? helperId : undefined}
          className="w-full aria-disabled:cursor-not-allowed aria-disabled:opacity-60 md:w-auto"
        >
          {submitting ? c.checking : c.auditButton}
        </Button>
        {gate.helper && (
          <p id={helperId} className="text-caption">
            {gate.helper}
          </p>
        )}
      </div>
    </form>
  );
}
