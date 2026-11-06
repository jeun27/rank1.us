// One enabled site rule's outcome, as record_fix_results takes it. detail only for 'fix'.
export type RuleKey = "R10" | "R11" | "R14" | "R16" | "R18" | "H1";
export type FixOutcome = "fix" | "ok" | "unchecked";
export type FixResult = {
  rule_key: RuleKey;
  result: FixOutcome;
  evidence: Record<string, unknown>;
  detail: string | null;
};

// Customer copy, exactly as docs/SCHEMA.md §5b (tests/unit/fixes checks it against the doc).
export const COPY: Record<RuleKey, string> = {
  R10: "Your menu is a {PDF/image}; there's no menu page with the dishes as text.",
  R11: "These dishes have no section or page of their own: {dishes}.",
  R14: "Your robots.txt blocks {bots} from {paths}. Check if you meant to.",
  R16: "Your site runs on Cloudflare. Its AI bot blocking is on by default for many new sites, and robots.txt can't show it. Check Security, then Bots, in your Cloudflare dashboard.",
  R18: "Your homepage shows almost no text without JavaScript, so ChatGPT can't read what you offer.",
  H1: "Tidy-up: your site has no Restaurant/Menu structured data. This is housekeeping, not an AI visibility fix.",
};

export const fix = (
  rule_key: RuleKey,
  evidence: Record<string, unknown>,
  fill: Record<string, string> = {},
): FixResult => ({
  rule_key,
  result: "fix",
  evidence,
  detail: Object.entries(fill).reduce((t, [k, v]) => t.replace(`{${k}}`, v), COPY[rule_key]),
});
export const ok = (rule_key: RuleKey, evidence: Record<string, unknown>): FixResult => ({
  rule_key,
  result: "ok",
  evidence,
  detail: null,
});
export const unchecked = (rule_key: RuleKey, reason: string, evidence: Record<string, unknown> = {}): FixResult => ({
  rule_key,
  result: "unchecked",
  evidence: { reason, ...evidence },
  detail: null,
});
