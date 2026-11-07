// Onboarding strings, all from docs/COPY.md (4b Onboarding 1-3, "Onboarding (lead, 2026-11-05)", Final set).
export const copy = {
  next: "Next",
  // COPY.md "UX (lead, 2026-11-06)" X24: beside a disabled Next.
  missing: {
    name: "Add your business name first.",
    cuisine: "Pick a cuisine first.",
    city: "Add your city first.",
    state: "Add your state first.",
    places: "Finding places near you…",
  },
  back: "Back",
  finish: "Finish setup",
  // The landing hero sub and the Example label, reused as they are (README §6).
  sub: "See how often ChatGPT, Gemini, Google AI Overview and Perplexity name your business, how you stack up against competitors, and what to fix next.",
  exampleData: "Example data",
  domain: { placeholder: "yoursite.com", noEnding: "Add the ending, like ramenhouse.com" },
  readingSite: "Reading your site…",
  unreadable: "We couldn't read that site. Type 3 things you sell.",
  name: "Business name",
  cuisine: "Cuisine",
  city: "City",
  state: "State",
  landmarks: "Landmarks",
  areas: "Areas",
  dietary: "Dietary",
  occasion: "Occasion",
  finding: (cuisine: string, city: string) => `Finding ${cuisine} places in ${city}…`,
  noneFound: (cuisine: string, city: string) =>
    `No local ${cuisine} places found near ${city}. Add competitors by name.`,
  fewFound: "Add competitors by name.",
  loadFailed: "Couldn't load nearby places. Add competitors by name.",
  competitorName: "Name",
  competitorDomain: "Domain",
  rating: "Rating",
  addCompetitor: "Add competitor",
  remove: "Remove",
  track: "Track",
  // COPY.md "UX (lead, 2026-11-06)" X23 (lead edit a: total is the plan limit).
  tracked: (n: number, total: number) => `${n} of ${total} questions tracked`,
  shortForm: "Short form",
  longForm: "Long form",
  level: "Location level",
  levels: { country: "Country", state: "State", city: "City" },
  edited: "Edited",
  emptyQuestion: (n: number) => `Couldn't save question ${n}: it's empty.`,
  cityNote: (engine: string) => `${engine} can't target a city yet, so we check it for the whole country.`,
  saveFailed: "We couldn't save your business. Try again.",
};

// P2 pending: onboarding v2 (O1) strings, README §6 Q1–Q3. They aren't in docs/COPY.md until the founder
// approves them (lead relays P2); a change is an edit here only.
export const welcome = {
  // P2 pending (Q3): the 4 steps, in the rail and the phone bar.
  steps: ["Your site", "Your business", "Competitors", "Questions"],
  stepOf: (n: number, step: string) => `Step ${n} of 4 · ${step}`,
  stepsLabel: "Setup steps",
  done: ", done",
  // P2 pending (Q1)
  label: "Your website",
  read: "Read my site",
  manual: "No website? Fill it in yourself",
  time: "About 5 minutes to set up.",
  // P2 pending (Q2)
  nextTitle: "What happens next",
  next: [
    () => "Rank1 reads your site and fills in a card you can change.",
    () => "Pick 3 to 5 businesses to compare against.",
    (total: number) => `Rank1 writes up to ${total} questions people ask AI about businesses like yours.`,
  ],
  exampleTitle: "What you'll see after your first check",
  footnote: "Every number shows how many answers it's based on.",
  forQuestion: "For the question",
  whoNames: "Who AI names",
  namedIn: "Named in",
  // OC10: the You row in an Example never shows a real name.
  you: "Your business",
  youTag: "You",
};
