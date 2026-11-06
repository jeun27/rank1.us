"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { formCopy as c } from "@/components/forms/copy";
import { Honeypot } from "@/components/forms/Honeypot";
import { PillField } from "@/components/forms/PillField";
import { postForm } from "@/components/forms/postForm";
import { Turnstile } from "@/components/forms/Turnstile";
import { INDUSTRIES, INDUSTRY_OTHER_MAX, TIERS, validateContact, type ContactField } from "@/lib/spam/validate";

type State =
  { kind: "idle" | "submitting" } | { kind: "error"; fields: ContactField[]; banner?: string } | { kind: "success" };

// industry_other has no string: the input caps it at 60 and only shows for "Other", so only a crafted request trips it.
const fieldError: Partial<Record<ContactField, string>> = {
  name: c.nameError,
  email: c.emailError,
  industry: c.industryError,
  tier: c.tierError,
  message: c.messageError,
};
const FIELDS: ContactField[] = ["name", "email", "industry", "industry_other", "tier", "message"];
const box =
  "w-full bg-paper text-ui text-ink outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep";
const boxEdge = (error?: string) => (error ? "border-2 border-brick" : "border border-fieldBorder");

// Contact us form, used on /contact and in the ContactUsLink modal.
export function ContactForm() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [resets, setResets] = useState(0);
  const form = useRef<HTMLFormElement>(null);
  const success = useRef<HTMLParagraphElement>(null);
  const [industry, setIndustry] = useState("");
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
    } else if (res.status === 400)
      showErrors(res.errors.filter((f): f is ContactField => FIELDS.includes(f as ContactField)));
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

  return (
    <form
      ref={form}
      noValidate
      onSubmit={onSubmit}
      className="relative flex flex-col gap-4"
      aria-busy={submitting || undefined}
    >
      {state.kind === "error" && state.banner && <Banner tone="error">{state.banner}</Banner>}
      <PillField label={c.nameLabel} name="name" autoComplete="name" required maxLength={100} error={err("name")} />
      <PillField
        label={c.emailLabel}
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        spellCheck={false}
        required
        error={err("email")}
      />
      <PillField label={c.companyLabel} name="company" autoComplete="organization" maxLength={100} />
      <SelectField
        label={c.industryLabel}
        name="industry"
        placeholder={c.industryPlaceholder}
        options={INDUSTRIES}
        error={err("industry")}
        value={industry}
        onChange={setIndustry}
      />
      {industry === "Other" && (
        <PillField
          label={c.industryOtherLabel}
          name="industry_other"
          maxLength={INDUSTRY_OTHER_MAX}
          error={err("industry_other")}
        />
      )}
      <SelectField
        label={c.tierLabel}
        name="tier"
        placeholder={c.tierPlaceholder}
        options={TIERS}
        error={err("tier")}
      />
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
          className={`block resize-y rounded-control px-3 py-2 ${box} ${boxEdge(err("message"))}`}
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

type SelectProps = {
  label: string;
  name: string;
  placeholder: string;
  options: readonly string[];
  error?: string;
  value?: string;
  onChange?: (v: string) => void;
};

// Required pill select whose disabled first option is the placeholder.
function SelectField({ label, name, placeholder, options, error, value, onChange }: SelectProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-caption font-semibold">
        {label}
      </label>
      <select
        id={id}
        name={name}
        required
        {...(onChange ? { value, onChange: (e) => onChange(e.target.value) } : { defaultValue: "" })}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`h-11 rounded-control px-3 md:h-9 ${box} ${boxEdge(error)}`}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-caption text-brick">
          {error}
        </p>
      )}
    </div>
  );
}
