import type { Vertical } from "@/lib/queries/onboarding";

// Question templates, verbatim from docs/UI.md ("Question templates"). The question_templates seed must match.
export type Slot =
  "cuisine" | "city" | "state" | "landmark" | "area" | "dietary" | "occasion" | "category" | "service" | "competitor";
// Which businesses a template is for (question_templates.vertical): restaurants, local services
// (every other vertical, incl. other), shops/brands (dtc) or software (saas).
export type Family = "restaurant" | "local" | "dtc" | "saas";

export type QuestionTemplate = {
  short_form: string;
  long_form: string;
  slots: Slot[];
  fixed_cuisine: string | null;
  fixed_city: string | null;
  origin: string;
  sort: number;
  family: Family;
  // "emergency …" is for trades only (origin "…, trades only").
  trades_only: boolean;
};

// vertical missing = restaurant (every caller before onboarding v2).
export type Business = {
  cuisine?: string | null;
  city: string;
  state: string;
  vertical?: Vertical;
  category?: string | null;
  services?: string[];
};
export type Picks = {
  landmarks: string[];
  areas: string[];
  dietary: string[];
  occasion: string[];
  competitors?: string[];
};
type ListSlot = "landmark" | "area" | "dietary" | "occasion" | "service" | "competitor";
export type Choice = Partial<Record<ListSlot, string>>;
export type FilledQuestion = { short_text: string; long_text: string };
// key is the row's template_key: "{sort}", plus "|{slot}={value}" for each pick it used. Stable across
// city and cuisine changes, so a saved card can rewrite the same row (save_business_card).
export type KeyedQuestion = FilledQuestion & { key: string };
export type BuiltQuestion = KeyedQuestion & { template_sort: number };

export const MAX_ACTIVE_QUESTIONS = 25;

const rows: [string, string, string, string | null, Family?][] = [
  [
    "best {cuisine} in {city}",
    "I'm in {city}, {state} with two friends tonight; where can we get really good {cuisine} that isn't too expensive and has quick seating?",
    "Pack draft",
    null,
  ],
  [
    "{cuisine} near {landmark}",
    "We're near {landmark} in {city} and want {cuisine} for lunch in under an hour; which nearby places are actually worth going to and why?",
    "Pack draft",
    null,
  ],
  [
    "best {cuisine} for a date in {city}",
    "Looking for a {cuisine} restaurant in {city} for a date night this weekend, nice but not stuffy, good drinks too; what would you recommend and why?",
    "Pack draft",
    null,
  ],
  [
    "family friendly {cuisine} {city}",
    "Where should a family with two young kids get {cuisine} in {city}, somewhere with easy parking, a kids menu and space for a stroller?",
    "Pack draft",
    null,
  ],
  [
    "{cuisine} delivery {city}",
    "Which {cuisine} places in {city} are best for delivery tonight, food that still tastes good after twenty minutes in a bag and fair prices?",
    "Pack draft",
    null,
  ],
  [
    "best {cuisine} near {landmark}",
    "We'll be around {landmark} in {city} this evening and want really good {cuisine}; which places nearby are worth the trip, and why?",
    "Growth (new)",
    null,
  ],
  [
    "{dietary}-friendly {cuisine} in {area}",
    "I eat {dietary} and I'm in {area}, {city}; which {cuisine} restaurants have plenty of clearly labeled {dietary} dishes, not just one side salad?",
    "Growth (new)",
    null,
  ],
  [
    "best {occasion} restaurant at {landmark}",
    "Planning a {occasion} at {landmark} in {city} this Saturday; which restaurant there would you book for good food, a comfortable noise level and easy reservations?",
    "Growth (new)",
    null,
  ],
  [
    "{cuisine} with outdoor seating in {area}",
    "Where can we get {cuisine} with nice outdoor seating in {area}, {city}, somewhere relaxed for a sunny afternoon with a small group of friends?",
    "Growth (new)",
    null,
  ],
  [
    "late-night {cuisine} near {landmark}",
    "It's 10:30 pm and we're near {landmark} in {city}; which {cuisine} places are still open late and actually good, not just fast food?",
    "Growth (new)",
    null,
  ],
  [
    "best ramen in Irvine",
    "I'm in Irvine tonight and craving a rich bowl of ramen; which ramen shops are the best right now, and how long are the waits?",
    "Growth Page (cuisine = ramen)",
    "ramen",
  ],
  [
    "best Korean BBQ in Irvine",
    "Taking four friends out for Korean BBQ in Irvine this weekend; which places have the best meat quality and service for a group?",
    "Growth Page (cuisine = Korean BBQ)",
    "Korean BBQ",
  ],
  [
    "best hot pot in Irvine",
    "Which hot pot restaurant in Irvine is best for a cold night with friends, with good broth choices, fresh ingredients and fair prices?",
    "Growth Page (cuisine = hot pot)",
    "hot pot",
  ],
  [
    "best dim sum in Irvine",
    "Where should my family go for weekend dim sum in Irvine, with classic dishes done well and a wait that isn't too long?",
    "Growth Page (cuisine = dim sum)",
    "dim sum",
  ],
  [
    "best sushi in Irvine",
    "Looking for the best sushi in Irvine, very fresh fish and a good chef's choice option without spending a fortune; where would you go?",
    "Growth Page (cuisine = sushi)",
    "sushi",
  ],
  [
    "best Sichuan in Irvine",
    "Which Sichuan restaurants in Irvine are truly spicy and authentic, good for mapo tofu and dan dan noodles, and worth the drive?",
    "Growth Page (cuisine = Sichuan)",
    "Sichuan",
  ],
  [
    "best pho in Irvine",
    "Where's the best pho in Irvine for a quick lunch, with a deep, clear broth, generous portions and reasonable prices for the area?",
    "Growth Page (cuisine = pho)",
    "pho",
  ],
  [
    "best brunch in Irvine",
    "Where can we get a great weekend brunch in Irvine, with good coffee, creative dishes and a table without a two-hour wait?",
    "Growth Page (cuisine = brunch)",
    "brunch",
  ],
  [
    "date night at Irvine Spectrum Center",
    "Planning a date night at Irvine Spectrum Center; which restaurant there has the best food and atmosphere for a relaxed dinner for two?",
    "Growth Page (every Irvine business)",
    null,
  ],
  [
    "lunch near Irvine Business Complex",
    "I work near the Irvine Business Complex and have 45 minutes for lunch; which nearby restaurants are good, quick and not overpriced?",
    "Growth Page (every Irvine business)",
    null,
  ],
  // Onboarding v2 Q10: the non-restaurant templates (founder P3; long forms lead-approved under P3, 2026-11-07).
  [
    "best {category} in {city}",
    "I'm in {city}, {state} and need a {category} I can trust; who are the best options nearby, and what makes them stand out?",
    "Onboarding v2 Q10",
    null,
    "local",
  ],
  [
    "{service} in {city}",
    "I need {service} at my place in {city}, {state} this week; which local businesses do it well, at a fair price, and can come soon?",
    "Onboarding v2 Q10",
    null,
    "local",
  ],
  [
    "emergency {category} near me in {city}",
    "It's late and I have an emergency at home in {city}, {state}; which {category} can come out tonight, and who answers fast?",
    "Onboarding v2 Q10, trades only",
    null,
    "local",
  ],
  [
    "affordable {service} in {city}",
    "I'm on a tight budget and need {service} in {city}, {state}; who does good work without overcharging, and what should I expect to pay?",
    "Onboarding v2 Q10",
    null,
    "local",
  ],
  [
    "{category} with good reviews in {city}",
    "Which {category} in {city}, {state} has the best recent reviews from real customers, and what do people say they do better?",
    "Onboarding v2 Q10",
    null,
    "local",
  ],
  [
    "who does {service} near {area}",
    "I live near {area} in {city} and need {service}; which local businesses cover my area, and who would you call first and why?",
    "Onboarding v2 Q10",
    null,
    "local",
  ],
  [
    "best {category} brands",
    "I'm shopping for {category} and want something that lasts; which brands are worth the money right now, and how do they differ?",
    "Onboarding v2 Q10",
    null,
    "dtc",
  ],
  [
    "where to buy {service}",
    "Where can I buy {service} online from a brand I can trust, with fair shipping and easy returns if it doesn't work out?",
    "Onboarding v2 Q10",
    null,
    "dtc",
  ],
  [
    "{category} brands like {competitor}",
    "I like {competitor} but want to try something similar; which other {category} brands are as good or better, and how do they compare?",
    "Onboarding v2 Q10",
    null,
    "dtc",
  ],
  [
    "best {category} software",
    "We're a small team picking {category} software this month; which tools are best right now, and what is each one best at?",
    "Onboarding v2 Q10",
    null,
    "saas",
  ],
  [
    "{category} tools for small businesses",
    "I run a five-person business; which {category} tools are easy to set up, fairly priced and good enough to grow with?",
    "Onboarding v2 Q10",
    null,
    "saas",
  ],
  [
    "alternatives to {competitor}",
    "We use {competitor} but it's getting expensive and clunky; what are the best alternatives right now, and why switch?",
    "Onboarding v2 Q10",
    null,
    "saas",
  ],
];

const slotsIn = (text: string) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as Slot))];

export const TEMPLATES: QuestionTemplate[] = rows.map(([short_form, long_form, origin, fixed_cuisine, family], i) => ({
  short_form,
  long_form,
  slots: slotsIn(`${short_form} ${long_form}`),
  fixed_cuisine,
  fixed_city: origin.startsWith("Growth Page") ? "Irvine" : null,
  origin,
  sort: i + 1,
  family: family ?? "restaurant",
  trades_only: origin.endsWith(", trades only"),
}));

const TRADES: readonly Vertical[] = ["hvac", "plumbing", "roofing", "pest_control", "auto"];
export const familyOf = (vertical: Vertical | undefined): Family =>
  !vertical || vertical === "restaurant"
    ? "restaurant"
    : vertical === "saas" || vertical === "dtc"
      ? vertical
      : "local";
const text = (v: string | null | undefined) => v?.trim() || undefined;
// In question text the category reads in lower case ("best plumber in Irvine"); all-caps words (HVAC,
// CRM) stay as written. Keys don't include it, so a case change only moves text (UI3 F2).
const categoryText = (v: string | null | undefined) =>
  text(v)
    ?.split(/\s+/)
    .map((w) => (/^[A-Z0-9]{2,}$/.test(w) ? w : w.toLowerCase()))
    .join(" ");

// G1's YouTube keyword (§4): local = the first service + city (no services: category + city);
// restaurant = "{cuisine} {city}"; saas/dtc = the category, no city. Null when there's nothing to use.
export function youtubeKeyword(b: Business): string | null {
  const family = familyOf(b.vertical);
  const term =
    family === "restaurant"
      ? text(b.cuisine)
      : family === "local"
        ? ((b.services ?? []).map(text).find(Boolean) ?? text(b.category))
        : text(b.category);
  if (!term) return null;
  return family === "saas" || family === "dtc" ? term : [term, text(b.city)].filter(Boolean).join(" ");
}

// Replaces every {slot}; throws if a slot has no value.
export function fillTemplate(t: QuestionTemplate, business: Business, choice: Choice): FilledQuestion {
  const values: Partial<Record<Slot, string>> = {
    cuisine: text(business.cuisine),
    city: text(business.city),
    state: text(business.state),
    category: categoryText(business.category),
    ...choice,
  };
  const fill = (text: string) =>
    text.replace(/\{(\w+)\}/g, (_, slot: Slot) => {
      const value = values[slot];
      if (!value) throw new Error(`No value for {${slot}} in "${t.short_form}"`);
      return value;
    });
  return { short_text: fill(t.short_form), long_text: fill(t.long_form) };
}

const pickLists = (picks: Picks, business: Business): Record<ListSlot, string[]> => ({
  landmark: picks.landmarks,
  area: picks.areas,
  dietary: picks.dietary,
  occasion: picks.occasion,
  service: (business.services ?? []).map((x) => x.trim()).filter(Boolean),
  competitor: picks.competitors ?? [],
});

const same = (a: string | null, b: string) => a === null || a.toLowerCase() === b.toLowerCase();

// One question per combination of picks for the template's slots, in slot order. Empty if a slot has no picks.
export function expandTemplate(t: QuestionTemplate, business: Business, picks: Picks): KeyedQuestion[] {
  if (t.family !== familyOf(business.vertical)) return [];
  if (t.trades_only && !TRADES.includes(business.vertical!)) return [];
  if (!same(t.fixed_cuisine, business.cuisine ?? "") || !same(t.fixed_city, business.city)) return [];
  // A missing one-value slot (no category, no cuisine…) skips the template instead of throwing.
  const scalars = {
    cuisine: business.cuisine,
    city: business.city,
    state: business.state,
    category: business.category,
  };
  if (t.slots.some((slot) => slot in scalars && !text(scalars[slot as keyof typeof scalars]))) return [];
  const lists = pickLists(picks, business);
  let choices: Choice[] = [{}];
  for (const slot of t.slots) {
    if (!(slot in lists)) continue;
    const key = slot as keyof Choice;
    choices = choices.flatMap((c) => lists[key].map((value) => ({ ...c, [key]: value })));
  }
  return choices.map((c) => ({
    ...fillTemplate(t, business, c),
    key: [String(t.sort), ...Object.entries(c).map(([slot, value]) => `${slot}=${value}`)].join("|"),
  }));
}

// A business's active questions: dedupe by short text (first template wins), then take round-robin
// across templates in sort order (1st of each, then 2nd of each, ...) up to MAX_ACTIVE_QUESTIONS.
export function buildQuestions(business: Business, picks: Picks): BuiltQuestion[] {
  const seen = new Set<string>();
  const perTemplate = TEMPLATES.map((t) =>
    expandTemplate(t, business, picks)
      .filter((q) => {
        const key = q.short_text.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((q) => ({ ...q, template_sort: t.sort })),
  );
  const out: BuiltQuestion[] = [];
  for (let round = 0; out.length < MAX_ACTIVE_QUESTIONS; round++) {
    const batch = perTemplate.map((qs) => qs[round]).filter(Boolean);
    if (batch.length === 0) break;
    out.push(...batch.slice(0, MAX_ACTIVE_QUESTIONS - out.length));
  }
  return out;
}
