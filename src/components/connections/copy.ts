// Connections strings: COPY.md "Connections (lead, 2026-11-06)", signed off by the lead (2026-11-06).
// The consent text states only what the code does (src/lib/connections/*): the scope, the GBP fields a
// DFY edit may change, review + log, how to revoke, no passwords.
export const connectionsCopy = {
  title: "Connections",
  names: {
    gbp: "Google Business Profile",
    search_console: "Google Search Console",
    ga4: "Google Analytics",
    site_cms: "Website / CMS",
    shopify: "Shopify",
    g2_capterra: "G2 / Capterra",
    opentable: "OpenTable",
    resy: "Resy",
    apple_business_connect: "Apple Business Connect",
    bing_places: "Bing Places",
    yelp: "Yelp",
    amazon: "Amazon",
  },
  tiers: { recommended: "Recommended", optional: "Optional", later: "Coming soon" },
  niches: {
    local: "For businesses people find on a map.",
    restaurant_booking: "For restaurants that take reservations.",
    site: "For businesses with their own website.",
    dtc_store: "For brands that sell online.",
    dtc_amazon: "For brands that sell on Amazon.",
    saas_reviews: "For software with review listings.",
    ai_referrals: "Shows visits that came from AI answers.",
  },
  // Plain words (lead sign-off); the enum names in the code stay connected / needs_reauth / revoked.
  statuses: { connected: "Connected", needs_reauth: "Needs reconnect", revoked: "Disconnected" },
  comingSoon: "Coming soon",
  connect: "Connect",
  reconnect: "Reconnect",
  disconnect: "Disconnect",
  notify: "Notify me",
  noted: "We'll let you know.",
  continue: "Continue to Google",
  cancel: "Cancel",
  save: "Save",
  pick: { gbp: "Choose locations", search_console: "Choose sites", ga4: "Choose properties" },
  fields: {
    description: "Description",
    regular_hours: "Hours",
    special_hours: "Special hours",
    website_uri: "Website",
    primary_phone: "Primary phone",
    attributes: "Attributes",
  },
  consent: {
    gbp: [
      "Rank1 asks Google to manage your Business Profile (business.manage) and to know which Google account you used. We don't get your email or profile.",
      "We only change these fields, and only after you or the Rank1 team confirm: description, hours, special hours, website, primary phone and attributes.",
      "Every change is shown before it's applied, and logged with who made it, when, and what changed.",
      "To stop, use Disconnect here, or remove Rank1 at myaccount.google.com/permissions.",
      "We never ask for your password.",
    ],
    search_console: [
      "Rank1 asks Google for read-only access to Search Console (webmasters.readonly) and to know which Google account you used. We don't get your email or profile.",
      "We can only read. We never change anything in Search Console.",
      "To stop, use Disconnect here, or remove Rank1 at myaccount.google.com/permissions.",
      "We never ask for your password.",
    ],
    ga4: [
      "Rank1 asks Google for read-only access to Google Analytics (analytics.readonly) and to know which Google account you used. We don't get your email or profile.",
      "We can only read. We never change anything in Google Analytics.",
      "To stop, use Disconnect here, or remove Rank1 at myaccount.google.com/permissions.",
      "We never ask for your password.",
    ],
  },
  // The existing lead string: one Google grant covers all three.
  revokeConfirm: "This also disconnects Search Console and Analytics",
  changes: "Changes",
  failed: "We couldn't do that. Try again.",
  outcomes: {
    connected: (name: string) => `${name} is connected.`,
    denied: "Nothing was connected: Google access wasn't allowed.",
    error: "We couldn't connect that. Try again.",
  },
  // C-b (COPY.md "C-b, signed off by the lead"): the onboarding connect step and the dashboard card.
  card: {
    title: "Connect your accounts",
    intro: "One click each, with Google's own sign-in. We never see your password, and you can disconnect any time.",
    count: (n: number, m: number) => `${n} of ${m} connected`,
    skip: "Skip for now",
    toDashboard: "Go to your dashboard",
    readyTitle: "You're all set. We'll take it from here.",
    readyBody: (audience: "self" | "dfy", names: string[]) => {
      const one = names.length === 1;
      const joined = one ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
      const head = `${joined} ${one ? "is" : "are"} connected.`;
      return audience === "dfy"
        ? `${head} The Rank1 team takes it from here, and every change shows in your change log.`
        : `${head} Your fix list and reports now use ${one ? "it" : "them"}.`;
    },
    industry: "What kind of business?",
    verticals: {
      restaurant: "Restaurant",
      hvac: "HVAC",
      plumbing: "Plumbing",
      roofing: "Roofing",
      pest_control: "Pest control",
      auto: "Auto repair",
      beauty: "Beauty & salons",
      gym: "Gyms & fitness",
      events: "Events & venues",
      dental: "Dental",
      saas: "Software (SaaS)",
      dtc: "Online store",
      other: "Other",
    },
  },
} as const;
