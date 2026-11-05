"use client";
import { Badge } from "@/components/ui/Badge";
import type { CompetitorSearch, LocalPlace, OnboardingActions } from "@/app/app/onboarding/contract";
import { Onboarding, emptyDraft, type Draft } from "@/app/app/onboarding/Onboarding";

// Example data: invented places and brands. Lookups never resolve, so each state stays put.
const places: LocalPlace[] = [
  { name: "Diamond Jamboree", kind: "landmark" },
  { name: "Irvine Spectrum Center", kind: "landmark" },
  { name: "UC Irvine", kind: "landmark" },
  { name: "Northwood", kind: "area" },
  { name: "Turtle Rock", kind: "area" },
  { name: "Woodbridge", kind: "area" },
];
const cuisines = ["ramen", "sushi", "pho", "Korean BBQ", "hot pot", "dim sum", "Sichuan", "brunch"];
const items = [
  "Example Noodle Bar",
  "Example Izakaya",
  "Example Tonkotsu Co.",
  "Example Udon House",
  "Example Pho Spot",
].map((name, i) => ({
  name,
  domain: `example-${i + 1}.test`,
  rating: [4.6, 4.4, 4.3, 4.1, 3.9][i],
  cid: `example-cid-${i + 1}`,
}));
const pending = () => new Promise<never>(() => {});
const actions: OnboardingActions = { readSite: pending, findCompetitors: pending, finish: pending };

const business = { ...emptyDraft.business, domain: "exampleramen.test", name: "Example Ramen House", cuisine: "ramen" };
const picks = {
  landmarks: ["Diamond Jamboree", "Irvine Spectrum Center", "UC Irvine"],
  areas: ["Northwood", "Turtle Rock", "Woodbridge"],
  dietary: ["vegan", "vegetarian"],
  occasion: ["date night"],
};
const key = ["ramen", "Irvine", "CA", "exampleramen.test"].join("|");
const found = (result: CompetitorSearch): Partial<Draft> => ({
  step: 2,
  site: "ok",
  business,
  picks,
  search: { key, result },
  competitors: result.items.map((c) => ({
    name: c.name,
    domain: c.domain ?? null,
    rating: c.rating ?? null,
    cid: c.cid,
    checked: true,
  })),
});

const STATES: [string, Partial<Draft>, Partial<OnboardingActions>?][] = [
  ["1 empty", {}],
  ["1 loading", { site: "loading", business: { ...emptyDraft.business, domain: "exampleramen.test" } }],
  ["1 error", { site: "unreadable", business: { ...emptyDraft.business, domain: "exampleramen.test" } }],
  ["1 partial", { site: "ok", business: { ...business, cuisine: "" } }],
  ["1 success", { site: "ok", business, picks }],
  ["2 loading", { step: 2, site: "ok", business, picks, search: { key, result: null } }],
  ["2 success", found({ status: "ok", items })],
  ["2 partial", found({ status: "ok", items: items.slice(0, 2) })],
  ["2 empty", found({ status: "ok", items: [] })],
  ["2 error", found({ status: "missing_keys", items: [] })],
  ["3 success", { step: 3, site: "ok", business, picks }],
  ["3 error", { step: 3, site: "ok", business, picks }, { finish: async () => ({ error: "save_failed" }) }],
];

export function Gallery() {
  return (
    <div className="mt-8 flex flex-col gap-16">
      {STATES.map(([name, patch, over]) => (
        <section
          key={name}
          data-state={name}
          aria-labelledby={`state-${name.replace(" ", "-")}`}
          className="flex flex-col gap-4"
        >
          <p id={`state-${name.replace(" ", "-")}`} className="flex items-center gap-2 text-caption text-inkMuted">
            {name} <Badge tone="info">Example data</Badge>
          </p>
          <Onboarding
            places={places}
            cuisines={cuisines}
            actions={{ ...actions, ...over }}
            initial={{ ...emptyDraft, ...patch }}
            syncUrl={false}
          />
        </section>
      ))}
    </div>
  );
}
