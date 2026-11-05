import { TEMPLATES } from "@/lib/questions/templates";

// The fixed cuisine list: the restaurant templates' fixed_cuisine values first, then common ones.
// readSite() matches site text against these words; no LLM.
const COMMON = [
  "Mexican",
  "tacos",
  "Italian",
  "pizza",
  "Chinese",
  "Japanese",
  "Korean",
  "Thai",
  "Vietnamese",
  "Indian",
  "Mediterranean",
  "Greek",
  "Middle Eastern",
  "Persian",
  "Filipino",
  "Hawaiian",
  "poke",
  "American",
  "burgers",
  "BBQ",
  "steakhouse",
  "seafood",
  "sandwiches",
  "salads",
  "vegan",
  "breakfast",
  "bakery",
  "dessert",
  "coffee",
  "boba",
  "tea",
];

export const CUISINES: readonly string[] = [
  ...new Set([...TEMPLATES.flatMap((t) => (t.fixed_cuisine ? [t.fixed_cuisine] : [])), ...COMMON]),
];
