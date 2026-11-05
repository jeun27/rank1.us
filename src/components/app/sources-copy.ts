// Sources strings, all from docs/COPY.md (4b Sources, AEO.md, "Sources (lead, 2026-11-05)").
export const sourcesCopy = {
  title: "Sources",
  subtitle: "See which sites each AI cites for your questions.",
  empty: "No cited links yet. They show after your first run.",
  noLinks: (engine: string) => `No links cited by ${engine}`,
  location: "Location",
  allLocations: "All locations",
  exact: "Exact",
  fallback: "Country fallback",
  fallbackTip: (engine: string) => `${engine} can't target a city yet, so we check it for the whole country.`,
  category: "Category",
  domain: "Domain",
  links: "Links",
  engines: "Engines",
  categories: {
    reddit: "Reddit",
    youtube: "YouTube",
    social: "Social",
    review_directory: "Review sites",
    news_blog: "News and blogs",
    other: "Other",
  },
};
