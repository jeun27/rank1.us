import { HONEYPOT_FIELD } from "./validate";

// Contact us: 3 requests per IP hash per rolling hour, counted from contact_requests.
export const CONTACT_LIMIT = 3;
export const contactWindowStart = (now: Date) => new Date(now.getTime() - 60 * 60 * 1000);

// Free audits: AUDIT_DAILY_LIMIT leads per UTC day across all visitors (a spend cap).
export const utcDayStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

export function auditDailyLimit(raw = process.env.AUDIT_DAILY_LIMIT): number {
  const n = Number(raw);
  if (!raw || !Number.isInteger(n) || n < 0) throw new Error("AUDIT_DAILY_LIMIT must be a whole number");
  return n;
}

export const honeypotFilled = (body: Record<string, unknown>) => typeof body[HONEYPOT_FIELD] === "string" && body[HONEYPOT_FIELD] !== "";
