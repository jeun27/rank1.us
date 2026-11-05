// Form strings, all from docs/COPY.md ("Contact us" row, Final set, "Forms (lead, 2026-11-05)").
export const formCopy = {
  auditButton: "Get my free audit",
  checking: "Checking…",
  emailLabel: "Email",
  domainLabel: "Your domain",
  domainPlaceholder: "yourbusiness.com",
  domainError: "Add the ending, like ramenhouse.com",
  auditSuccess: (email: string) => `Got it. We'll email your audit to ${email}.`,

  contactTitle: "Contact us",
  nameLabel: "Name",
  companyLabel: "Company",
  tierLabel: "Tier",
  messageLabel: "Message",
  send: "Send",
  sending: "Sending…",
  sendError: "That didn't send. Try again in a minute.",
  tooMany: "Too many tries. Try again in an hour.",
  contactSuccess: "Thanks. We'll reply by email within 2 business days.",

  // Pending strings from the lead (asked 2026-11-05).
  emailError: "[PLACEHOLDER] email error",
  nameError: "[PLACEHOLDER] name error",
  companyError: "[PLACEHOLDER] company error",
  tierError: "[PLACEHOLDER] tier error",
  messageError: "[PLACEHOLDER] message error",
  tierPlaceholder: "[PLACEHOLDER] tier placeholder",
  auditError: "[PLACEHOLDER] audit error",
  auditTooMany: "[PLACEHOLDER] audit limit",
  close: "[PLACEHOLDER] close",
};
