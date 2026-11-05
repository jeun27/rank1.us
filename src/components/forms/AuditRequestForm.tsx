"use client";

import { useRef, useState, type FormEvent } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { validateAudit } from "@/lib/spam/validate";
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
export function AuditRequestForm() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [resets, setResets] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const success = useRef<HTMLParagraphElement>(null);

  function showErrors(fields: Field[], banner?: string) {
    setState({ kind: "error", fields, banner });
    const first = fields[0];
    if (first) requestAnimationFrame(() => form.current?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus());
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const el = e.currentTarget;
    const check = validateAudit(Object.fromEntries(new FormData(el)));
    if (!check.ok) return showErrors(check.errors);
    setState({ kind: "submitting" });
    const res = await postForm("/api/audit/request", el);
    setResets((n) => n + 1);
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
    <form ref={form} noValidate onSubmit={onSubmit} className="relative flex w-full max-w-160 flex-col gap-4" aria-busy={submitting || undefined}>
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
      <Turnstile resetSignal={resets} />
      <Button type="submit" variant="final" loading={submitting} className="w-full md:w-auto md:self-start">
        {submitting ? c.checking : c.auditButton}
      </Button>
    </form>
  );
}
