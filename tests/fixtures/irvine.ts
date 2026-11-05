// Irvine places, dietary and occasion options, as listed in docs/UI.md ("Question templates", "Irvine places").
export type IrvinePlace = {
  name: string;
  kind: "landmark" | "area";
  note?: string;
  members?: string[];
  checked?: string;
};

export const IRVINE_PLACES: IrvinePlace[] = [
  { name: "UC Irvine", kind: "landmark" },
  { name: "Irvine Spectrum Center", kind: "landmark" },
  { name: "Diamond Jamboree", kind: "landmark" },
  { name: "Irvine Business Complex", kind: "landmark" },
  { name: "John Wayne Airport", kind: "landmark" },
  { name: "OC Great Park", kind: "landmark" },
  { name: "The Market Place", kind: "landmark", note: "Tustin/Irvine edge" },
  { name: "Irvine Valley College", kind: "landmark" },
  { name: "Concordia University Irvine", kind: "landmark" },
  { name: "Culver Plaza", kind: "landmark" },
  { name: "Heritage Plaza", kind: "landmark" },
  { name: "Park Place", kind: "landmark" },
  {
    name: "Eighteen Main",
    kind: "landmark",
    note: "cluster",
    members: [
      "SOL Mexican Cocina",
      "KIT Coffee",
      "The Goldfinch",
      "Izakaya Osen",
      "The Trough",
      "Fat of the Land",
    ],
    checked: "2026-11-04",
  },
  { name: "Woodbridge", kind: "area", note: "village" },
  { name: "Northwood", kind: "area", note: "village" },
  { name: "Turtle Rock", kind: "area", note: "village" },
  { name: "University Park", kind: "area", note: "village" },
  { name: "Quail Hill", kind: "area", note: "village" },
  { name: "Westpark", kind: "area" },
];

export const DIETARY = ["vegan", "vegetarian", "gluten-free", "halal", "kosher"] as const;
export const OCCASIONS = ["date night", "birthday", "business lunch", "large group"] as const;
