// docs/COPY.md "Billing (lead, 2026-11-05)" and UI.md 4b "Billing + switcher" / "Business switcher".
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const plural = (n: number) => `${n} ${n === 1 ? "business" : "businesses"}`;

export const billingCopy = {
  title: "Billing",
  start: "Start for $99/mo",
  plan: "Plan",
  // UI.md: '2 businesses x $99 = $198/mo'. The math only; amounts are never fetched from Stripe.
  planLine: (n: number) => `${plural(n)} x $99 = $${n * 99}/mo`,
  nextInvoice: (iso: string) => `Next invoice ${fmtDate(iso)}`,
  manage: "Manage billing",
  failed: "Your last payment failed. Weekly checks are paused.",
  updateCard: "Update card",
  pastDue: "Past due",
  openFailed: "We couldn't open billing. Try again in a minute.",
  // Business switcher
  switcher: "Business switcher",
  search: "Search businesses",
  active: "Active",
  paused: "Paused",
  addRow: "+ Add a business ($99/mo)",
  addDialog: (n: number) =>
    `Add a business? Your plan goes from ${n} x $99 to ${n + 1} x $99 = $${(n + 1) * 99}/mo. Prorated today.`,
  addConfirm: "Add business",
  adding: "Adding your business…",
  retry: "Try again",
  more: (name: string) => `More for ${name}`,
  remove: "Remove business",
  removeDialog: (name: string, periodEnd: string | null, n: number) =>
    `Remove ${name}? Checks continue until ${periodEnd ? fmtDate(periodEnd) : "the end of this period"}; then your plan drops to ${n - 1} x $99.`,
  cancel: "Cancel",
  agency: "Need 10+ businesses or done-for-you?",
  contact: "Contact us.",
};
