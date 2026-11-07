// Onboarding strings, all from docs/COPY.md (4b Onboarding 1-3, "Onboarding (lead, 2026-11-05)", Final set).
export const copy = {
  title: "Add your business",
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

// Onboarding v2, O1 (founder-approved P2, 2026-11-07): README §6 Q1–Q3, in docs/COPY.md "Onboarding v2".
export const welcome = {
  steps: ["Your site", "Your business", "Competitors", "Questions"],
  stepOf: (n: number, step: string) => `Step ${n} of 4 · ${step}`,
  label: "Your website",
  read: "Read my site",
  manual: "No website? Fill it in yourself",
  time: "About 5 minutes to set up.",
  nextTitle: "What happens next",
  next: [
    () => "Rank1 reads your site and fills in a card you can change.",
    () => "Pick 3 to 5 businesses to compare against.",
    (total: number) => `Rank1 writes up to ${total} questions people ask AI about businesses like yours.`,
  ],
  exampleTitle: "What you'll see after your first check",
  footnote: "Every number shows how many answers it's based on.",
  // OC10: the You row in an Example never shows a real name.
  you: "Your business",
  // Reused as they are: the leaderboard headers, the You tag, the page title (the rail's list name) and the
  // Fix list's "Done" (a finished step, for screen readers).
  business: "Business",
  visibility: "Visibility",
  youTag: "You",
  stepsLabel: "Add your business",
  done: "Done",
};

// Onboarding v2, O1 (founder-approved P2): README §6 Q4 (the reading log) and Q8 (unreadable).
export const reading = {
  title: (domain: string) => `Reading ${domain}`,
  count: (n: number) => `${n} of 4`,
  opened: (domain: string) => `Opened ${domain}`,
  details: "Business details",
  foundSchema: (fields: string) => `Found ${fields} in schema.org`,
  notOnSite: "Not on your site",
  head: "Title and description",
  foundHead: "Found in the page head",
  services: "Services",
  readingServices: "Reading your menu links…",
  // Q5's tag, reused for the finished Services stage.
  servicesFound: (n: number) => `${n} found in your menu`,
  note: "No AI reads your site. Rank1 only looks at what your pages already say.",
  button: "Reading…",
  unreadable: "We couldn't read that site. Fill in your business below.",
};

// Onboarding v2, O1 (founder-approved P2): README §6 Q5/Q6/Q7 and §8 Q5b, the business card (UI3).
export const card = {
  title: "Check your business",
  filled: (domain: string) => `We filled this in from ${domain}.`,
  change: "Change anything that's wrong.",
  type: "Business type",
  kinds: { restaurant: "Restaurant", local: "Local service", dtc: "Shop or brand", saas: "Software", other: "Other" },
  pickOne: "Pick one",
  typeHint:
    "This decides which details we ask for and which questions Rank1 writes. Restaurants also pick a cuisine, dietary options and occasions.",
  detected: "Detected from your website",
  notOnSite: "Not on your site",
  whatYouDo: "What you do",
  address: "Address",
  phone: "Phone",
  areaServed: "Area you serve",
  nearby: (city: string) => `${city} and nearby cities`,
  areaHint: "We picked this from your city. Change it if you travel further.",
  services: "Services",
  addService: "+ Add a service",
  menu: "Menu highlights",
  addDish: "+ Add a dish",
  found: (n: number) => `${n} found in your menu`,
  dietary: "Dietary options you serve",
  dietaryHint: "Pick any that apply. Rank1 doesn't guess these.",
  landmarks: "Landmarks near you",
  places: (city: string) => `Places in ${city}`,
  landmarksHint: "Pick up to 3. Shown only when Rank1 knows places in your city.",
  next: "Looks right, next",
  later: "You can change all of this later in Settings.",
  // Q7: the question preview.
  preview: "Questions Rank1 will ask AI",
  previewHint: "Built from your card. They change as you edit it.",
  previewLater: "You'll see and edit all of them in step 4.",
  shown: (n: number, total: number) => `${n} of ${total}`,
  phonePreview: (question: string, n: number) => `Rank1 will ask AI: “${question}” and ${n} more`,
  // Pending founder copy (one line): the X24 reason when no type is picked.
  missingType: "Pick a business type first.",
};
