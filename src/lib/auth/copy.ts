// Auth strings, all from docs/COPY.md ("Sign in" row, "Auth (lead, 2026-11-05)", "Forms (lead, 2026-11-05)").
export const authCopy = {
  title: "Sign in to Rank1",
  google: "Continue with Google",
  openingGoogle: "Opening Google…",
  googleError: "Google sign-in didn't finish. Try again, or use an email link.",
  emailLabel: "Email",
  emailError: "Add a valid email, like you@ramenhouse.com",
  sendLink: "Email me a sign-in link",
  linkSent: (email: string) => `Check your email. We sent a sign-in link to ${email}.`,
  sendError: "That link didn't send. Try again in a minute.",
  linkExpired: "[PLACEHOLDER] That sign-in link expired. Enter your email for a new one.",
  account: "Account",
  signOut: "Sign out",
  logIn: "Log in",
  checkoutClosed: "Checkout isn't open yet.",
};
