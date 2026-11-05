// Question templates, verbatim from docs/UI.md ("Question templates"). The question_templates seed must match.
export type Slot = "cuisine" | "city" | "state" | "landmark" | "area" | "dietary" | "occasion";

export type QuestionTemplate = {
  short_form: string;
  long_form: string;
  slots: Slot[];
  fixed_cuisine: string | null;
  fixed_city: string | null;
  origin: string;
  sort: number;
};

export type Business = { cuisine: string; city: string; state: string };
export type Picks = { landmarks: string[]; areas: string[]; dietary: string[]; occasion: string[] };
export type Choice = Partial<Record<"landmark" | "area" | "dietary" | "occasion", string>>;
export type FilledQuestion = { short_text: string; long_text: string };
export type BuiltQuestion = FilledQuestion & { template_sort: number };

export const MAX_ACTIVE_QUESTIONS = 25;

const rows: [string, string, string, string | null][] = [
  ["best {cuisine} in {city}", "I'm in {city}, {state} with two friends tonight; where can we get really good {cuisine} that isn't too expensive and has quick seating?", "Pack draft", null],
  ["{cuisine} near {landmark}", "We're near {landmark} in {city} and want {cuisine} for lunch in under an hour; which nearby places are actually worth going to and why?", "Pack draft", null],
  ["best {cuisine} for a date in {city}", "Looking for a {cuisine} restaurant in {city} for a date night this weekend, nice but not stuffy, good drinks too; what would you recommend and why?", "Pack draft", null],
  ["family friendly {cuisine} {city}", "Where should a family with two young kids get {cuisine} in {city}, somewhere with easy parking, a kids menu and space for a stroller?", "Pack draft", null],
  ["{cuisine} delivery {city}", "Which {cuisine} places in {city} are best for delivery tonight, food that still tastes good after twenty minutes in a bag and fair prices?", "Pack draft", null],
  ["best {cuisine} near {landmark}", "We'll be around {landmark} in {city} this evening and want really good {cuisine}; which places nearby are worth the trip, and why?", "Growth (new)", null],
  ["{dietary}-friendly {cuisine} in {area}", "I eat {dietary} and I'm in {area}, {city}; which {cuisine} restaurants have plenty of clearly labeled {dietary} dishes, not just one side salad?", "Growth (new)", null],
  ["best {occasion} restaurant at {landmark}", "Planning a {occasion} at {landmark} in {city} this Saturday; which restaurant there would you book for good food, a comfortable noise level and easy reservations?", "Growth (new)", null],
  ["{cuisine} with outdoor seating in {area}", "Where can we get {cuisine} with nice outdoor seating in {area}, {city}, somewhere relaxed for a sunny afternoon with a small group of friends?", "Growth (new)", null],
  ["late-night {cuisine} near {landmark}", "It's 10:30 pm and we're near {landmark} in {city}; which {cuisine} places are still open late and actually good, not just fast food?", "Growth (new)", null],
  ["best ramen in Irvine", "I'm in Irvine tonight and craving a rich bowl of ramen; which ramen shops are the best right now, and how long are the waits?", "Growth Page (cuisine = ramen)", "ramen"],
  ["best Korean BBQ in Irvine", "Taking four friends out for Korean BBQ in Irvine this weekend; which places have the best meat quality and service for a group?", "Growth Page (cuisine = Korean BBQ)", "Korean BBQ"],
  ["best hot pot in Irvine", "Which hot pot restaurant in Irvine is best for a cold night with friends, with good broth choices, fresh ingredients and fair prices?", "Growth Page (cuisine = hot pot)", "hot pot"],
  ["best dim sum in Irvine", "Where should my family go for weekend dim sum in Irvine, with classic dishes done well and a wait that isn't too long?", "Growth Page (cuisine = dim sum)", "dim sum"],
  ["best sushi in Irvine", "Looking for the best sushi in Irvine, very fresh fish and a good chef's choice option without spending a fortune; where would you go?", "Growth Page (cuisine = sushi)", "sushi"],
  ["best Sichuan in Irvine", "Which Sichuan restaurants in Irvine are truly spicy and authentic, good for mapo tofu and dan dan noodles, and worth the drive?", "Growth Page (cuisine = Sichuan)", "Sichuan"],
  ["best pho in Irvine", "Where's the best pho in Irvine for a quick lunch, with a deep, clear broth, generous portions and reasonable prices for the area?", "Growth Page (cuisine = pho)", "pho"],
  ["best brunch in Irvine", "Where can we get a great weekend brunch in Irvine, with good coffee, creative dishes and a table without a two-hour wait?", "Growth Page (cuisine = brunch)", "brunch"],
  ["date night at Irvine Spectrum Center", "Planning a date night at Irvine Spectrum Center; which restaurant there has the best food and atmosphere for a relaxed dinner for two?", "Growth Page (every Irvine business)", null],
  ["lunch near Irvine Business Complex", "I work near the Irvine Business Complex and have 45 minutes for lunch; which nearby restaurants are good, quick and not overpriced?", "Growth Page (every Irvine business)", null],
];

const slotsIn = (text: string) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as Slot))];

export const TEMPLATES: QuestionTemplate[] = rows.map(([short_form, long_form, origin, fixed_cuisine], i) => ({
  short_form,
  long_form,
  slots: slotsIn(`${short_form} ${long_form}`),
  fixed_cuisine,
  fixed_city: origin.startsWith("Growth Page") ? "Irvine" : null,
  origin,
  sort: i + 1,
}));

// Replaces every {slot}; throws if a slot has no value.
export function fillTemplate(t: QuestionTemplate, business: Business, choice: Choice): FilledQuestion {
  const values: Partial<Record<Slot, string>> = { ...business, ...choice };
  const fill = (text: string) =>
    text.replace(/\{(\w+)\}/g, (_, slot: Slot) => {
      const value = values[slot];
      if (!value) throw new Error(`No value for {${slot}} in "${t.short_form}"`);
      return value;
    });
  return { short_text: fill(t.short_form), long_text: fill(t.long_form) };
}

const pickLists = (picks: Picks) =>
  ({ landmark: picks.landmarks, area: picks.areas, dietary: picks.dietary, occasion: picks.occasion }) as const;

const same = (a: string | null, b: string) => a === null || a.toLowerCase() === b.toLowerCase();

// One question per combination of picks for the template's slots, in slot order. Empty if a slot has no picks.
export function expandTemplate(t: QuestionTemplate, business: Business, picks: Picks): FilledQuestion[] {
  if (!same(t.fixed_cuisine, business.cuisine) || !same(t.fixed_city, business.city)) return [];
  const lists = pickLists(picks);
  let choices: Choice[] = [{}];
  for (const slot of t.slots) {
    if (!(slot in lists)) continue;
    const key = slot as keyof Choice;
    choices = choices.flatMap((c) => lists[key].map((value) => ({ ...c, [key]: value })));
  }
  return choices.map((c) => fillTemplate(t, business, c));
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
