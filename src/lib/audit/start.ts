import type { LocationLevel } from "@/lib/engines/types";
import type { LocalCompetitorsResult, SiteRead } from "@/lib/onboarding/types";
import type { LocalPlace } from "@/lib/queries/places";
import { buildQuestions, type Picks } from "@/lib/questions/templates";

// Free-audit location: the schema defaults (lead decision).
export const FREE_AUDIT_LOCATION = { level: "city" as const, country: "US", state: "CA", city: "Irvine" };
// With no cuisine found, the generic templates' {cuisine} slot reads "restaurants" (lead, 2026-11-05).
export const NO_CUISINE = "restaurants";
const PICKS_PER_KIND = 3;

export type FreeAuditLead = { id: string; domain: string };

// create_free_audit's p (migration 0012). A null business name becomes the domain in the snapshot.
export type CreateFreeAuditInput = {
  lead_id: string;
  business: { name: string | null; domain: string; aliases?: string[] };
  competitors: { name: string; domain?: string; aliases?: string[] }[]; // ≤5, Maps order
  location: { country: string; state?: string; city?: string };
  questions: { text: string; location_level: LocationLevel }[]; // 1..25
};

export type StartDeps = {
  readSite: (domain: string) => Promise<SiteRead>;
  findLocalCompetitors: (input: {
    cuisine: string;
    city: string;
    state: string;
    domain?: string;
  }) => Promise<LocalCompetitorsResult>;
  listLocalPlaces: (city: string, state: string) => Promise<LocalPlace[]>;
  createFreeAudit: (input: CreateFreeAuditInput) => Promise<string>;
  log?: (line: string) => void;
};

// Free-audit default picks (lead, 2026-11-05): the first 3 verified landmarks and areas, vegan/vegetarian, date night.
export function defaultPicks(places: LocalPlace[]): Picks {
  const of = (kind: LocalPlace["kind"]) =>
    places
      .filter((p) => p.kind === kind)
      .slice(0, PICKS_PER_KIND)
      .map((p) => p.name);
  return { landmarks: of("landmark"), areas: of("area"), dietary: ["vegan", "vegetarian"], occasion: ["date night"] };
}

// Every input step degrades instead of failing. No LLM anywhere.
export async function buildFreeAudit(
  lead: FreeAuditLead,
  deps: Omit<StartDeps, "createFreeAudit">,
): Promise<CreateFreeAuditInput> {
  const { city, state } = FREE_AUDIT_LOCATION;
  const log = deps.log ?? (() => {});
  const site = await deps.readSite(lead.domain).catch((): SiteRead => ({ status: "unreadable" }));
  if (site.status !== "ok") log("free audit: site unreadable, using the domain as the brand");
  const cuisine = site.cuisine ?? NO_CUISINE;
  // No cuisine found → Maps searches plain "restaurant" (the keyword is "{cuisine} restaurant").
  const maps = await deps
    .findLocalCompetitors({ cuisine: site.cuisine ?? "", city, state, domain: lead.domain })
    .catch((): LocalCompetitorsResult => ({ status: "error", items: [] }));
  if (maps.status !== "ok") log(`free audit: competitors ${maps.status}`);
  const places = await deps.listLocalPlaces(city, state).catch((): LocalPlace[] => []);
  const questions = buildQuestions({ cuisine, city, state }, defaultPicks(places));
  const { country, state: st, city: ct } = FREE_AUDIT_LOCATION;
  return {
    lead_id: lead.id,
    business: { name: site.name ?? null, domain: lead.domain },
    competitors: maps.items.slice(0, 5).map((c) => ({ name: c.name, ...(c.domain ? { domain: c.domain } : {}) })),
    location: { country, state: st, city: ct },
    questions: questions.map((q) => ({ text: q.long_text, location_level: FREE_AUDIT_LOCATION.level })),
  };
}

// Starts a lead's free audit. Never throws; logs one line per problem, with no email, token or domain.
export async function startFreeAudit(lead: FreeAuditLead, deps: StartDeps): Promise<string | null> {
  const log = deps.log ?? ((l: string) => console.error(l));
  try {
    const input = await buildFreeAudit(lead, { ...deps, log });
    return await deps.createFreeAudit(input);
  } catch (e) {
    const code = typeof e === "object" && e && "code" in e ? String(e.code) : "error";
    log(`free audit: create_free_audit failed (${code})`);
    return null;
  }
}
