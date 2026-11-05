// Input checks for the public forms. Pure, so the browser and the API routes share them.
// Errors are field names; the form maps each one to its COPY.md string.

import { INDUSTRIES, INDUSTRY_OTHER_MAX, type Industry } from "@/lib/queries/contactRequests";

export const TIERS = ["Agency bundle", "Done-for-you (custom)", "Other"] as const;
export type Tier = (typeof TIERS)[number];
// Jeun #22: the list and the 60-character "Other" text match the contact_requests checks.
export { INDUSTRIES, INDUSTRY_OTHER_MAX, type Industry };

// The honeypot field: hidden from people, filled in by bots.
export const HONEYPOT_FIELD = "website";
// The hidden input the Turnstile widget adds to its form.
export const TURNSTILE_FIELD = "cf-turnstile-response";

export type Result<T, F extends string> = { ok: true; data: T } | { ok: false; errors: F[] };

export type AuditInput = { email: string; domain: string };
// Same industry rule as ContactRequestInsert: free text only goes with "Other".
export type ContactInput = { name: string; email: string; company: string | null; tier: Tier; message: string } & (
  { industry: Exclude<Industry, "Other">; industry_other: null } | { industry: "Other"; industry_other: string | null }
);

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
// Single-line text: no newlines or tabs (they end up in the email subject).
const line = (v: unknown) => str(v).replace(/\s+/g, " ");

export function isEmail(raw: unknown): boolean {
  const v = str(raw);
  return v.length <= 254 && EMAIL.test(v);
}

// "https://www.RamenHouse.com/menu?x=1" -> "ramenhouse.com". Null when it is not a domain with an ending.
export function normalizeDomain(raw: unknown): string | null {
  let v = str(raw).toLowerCase();
  v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  v = v
    .split(/[/?#]/)[0]
    .replace(/:\d+$/, "")
    .replace(/\.$/, "")
    .replace(/^www\./, "");
  if (v.length === 0 || v.length > 253) return null;
  const labels = v.split(".");
  if (labels.length < 2 || !labels.every((l) => LABEL.test(l))) return null;
  if (!/^[a-z]{2,63}$/.test(labels[labels.length - 1])) return null;
  return v;
}

export function validateAudit(body: Record<string, unknown>): Result<AuditInput, "email" | "domain"> {
  const errors: ("email" | "domain")[] = [];
  const domain = normalizeDomain(body.domain);
  if (!isEmail(body.email)) errors.push("email");
  if (!domain) errors.push("domain");
  if (errors.length) return { ok: false, errors };
  return { ok: true, data: { email: str(body.email), domain: domain! } };
}

export type ContactField = "name" | "email" | "industry" | "industry_other" | "tier" | "message";

export function validateContact(body: Record<string, unknown>): Result<ContactInput, ContactField> {
  const errors: ContactField[] = [];
  const name = line(body.name);
  // Optional, so never an error: anything past 100 characters is cut.
  const company = line(body.company).slice(0, 100);
  const message = str(body.message);
  const industry = INDUSTRIES.find((i) => i === body.industry);
  const industryOther = line(body.industry_other);
  const tier = TIERS.find((t) => t === body.tier);
  if (!name || name.length > 100) errors.push("name");
  if (!isEmail(body.email)) errors.push("email");
  if (!industry) errors.push("industry");
  // Free text only goes with "Other", and only up to 60 characters.
  else if (industryOther && (industry !== "Other" || industryOther.length > INDUSTRY_OTHER_MAX))
    errors.push("industry_other");
  if (!tier) errors.push("tier");
  if (!message || message.length > 5000) errors.push("message");
  if (errors.length) return { ok: false, errors };
  const base = { name, email: str(body.email), company: company || null, tier: tier!, message };
  return {
    ok: true,
    data:
      industry === "Other"
        ? { ...base, industry, industry_other: industryOther || null }
        : { ...base, industry: industry!, industry_other: null },
  };
}
