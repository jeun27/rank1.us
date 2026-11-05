"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { formCopy as c } from "@/components/forms/copy";
import { Honeypot } from "@/components/forms/Honeypot";
import { PillField } from "@/components/forms/PillField";
import { postForm } from "@/components/forms/postForm";
import { Turnstile } from "@/components/forms/Turnstile";
import { TIERS, validateContact, type ContactField } from "@/lib/spam/validate";

type State =
  | { kind: "idle" | "submitting" }
  | { kind: "error"; fields: ContactField[]; banner?: string }
  | { kind: "success" };

const fieldError: Record<ContactField, string> = {
  name: c.nameError,
  email: c.emailError,
  company: c.companyError,
  tier: c.tierError,
  message: c.messageError,
};
const FIELDS: ContactField[] = ["name", "email", "company", "tier", "message"];

// Contact us form, used on /contact and in the ContactUsLink modal.
export function ContactForm() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [resets, setResets] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const success = useRef<HTMLParagraphElement>(null);
  const tierId = useId();
  const messageId = useId();

  function showErrors(fields: ContactField[], banner?: string) {
    setState({ kind: "error", fields, banner });
    const first = FIELDS.find((f) => fields.includes(f));
    if (first) requestAnimationFrame(() => form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus());
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const el = e.currentTarget;
    const check = validateContact(Object.fromEntries(new FormData(el)));
    if (!check.ok) return showErrors(check.errors);
    setState({ kind: "submitting" });
    const res = await postForm("/api/contact", el);
    setResets((n) => n + 1);
    if (res.status === 200) {
      setState({ kind: "success" });
      requestAnimationFrame(() => success.current?.focus());
    } else if (res.status === 400) showErrors(res.errors.filter((f): f is ContactField => FIELDS.includes(f as ContactField)));
    else showErrors([], res.status === 429 ? c.tooMany : c.sendError);
  }

  if (state.kind === "success") {
    return (
      <p ref={success} tabIndex={-1} role="status" className="text-body-lg font-semibold text-moss outline-none">
        {c.contactSuccess}
      </p>
    );
  }

  const errors = state.kind === "error" ? state.fields : [];
  const err = (f: ContactField) => (errors.includes(f) ? fieldError[f] : undefined);
  const submitting = state.kind === "submitting";
  const boxEdge = (f: ContactField) => (err(f) ? "border-2 border-brick" : "border border-fieldBorder");
  const box = "w-full bg-white text-ui text-ink shadow-field outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep";

  return (
    <form ref={form} noValidate onSubmit={onSubmit} className="relative flex flex-col gap-4" aria-busy={submitting || undefined}>
      {state.kind === "error" && state.banner && <Banner tone="error">{state.banner}</Banner>}
      <PillField label={c.nameLabel} name="name" autoComplete="name" required maxLength={100} error={err("name")} />
      <PillField label={c.emailLabel} name="email" type="email" autoComplete="email" inputMode="email" spellCheck={false} required error={err("email")} />
      <PillField label={c.companyLabel} name="company" autoComplete="organization" maxLength={100} error={err("company")} />
      <div>
        <label htmlFor={tierId} className="mb-1.5 block text-caption font-semibold">
          {c.tierLabel}
        </label>
        <select
          id={tierId}
          name="tier"
          required
          defaultValue=""
          aria-invalid={err("tier") ? true : undefined}
          aria-describedby={err("tier") ? `${tierId}-error` : undefined}
          className={`h-12 rounded-full px-5 ${box} ${boxEdge("tier")}`}
        >
          <option value="" disabled>
            {c.tierPlaceholder}
          </option>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {err("tier") && (
          <p id={`${tierId}-error`} className="mt-1.5 text-caption text-brick">
            {err("tier")}
          </p>
        )}
      </div>
      <div>
        <label htmlFor={messageId} className="mb-1.5 block text-caption font-semibold">
          {c.messageLabel}
        </label>
        <textarea
          id={messageId}
          name="message"
          required
          rows={5}
          maxLength={5000}
          aria-invalid={err("message") ? true : undefined}
          aria-describedby={err("message") ? `${messageId}-error` : undefined}
          className={`block resize-y rounded-banner px-5 py-3 ${box} ${boxEdge("message")}`}
        />
        {err("message") && (
          <p id={`${messageId}-error`} className="mt-1.5 text-caption text-brick">
            {err("message")}
          </p>
        )}
      </div>
      <Honeypot />
      <Turnstile resetSignal={resets} />
      <Button type="submit" loading={submitting} className="w-full md:w-auto md:self-start">
        {submitting ? c.sending : c.send}
      </Button>
    </form>
  );
}
