// What onboarding uses from the backend (#20 queries) and data-pipeline (#23 site read, Maps). Step 5 brief.
import type { FindLocalCompetitorsInput, LocalCompetitor, LocalCompetitorsResult, SiteRead } from "@/lib/onboarding";
import type { OnboardingInput } from "@/lib/queries/onboarding";

export type { LocalPlace } from "@/lib/queries/places";
export type { OnboardingInput, SiteRead };
export type MapsCompetitor = LocalCompetitor;
export type CompetitorQuery = FindLocalCompetitorsInput & { domain: string };
// What the browser gets: the status and items, never the upstream error text.
export type CompetitorSearch = Omit<LocalCompetitorsResult, "error">;

export type OnboardingActions = {
  readSite: (domain: string) => Promise<SiteRead>;
  findCompetitors: (q: CompetitorQuery) => Promise<CompetitorSearch>;
  // Redirects to /app on success; returns an error code otherwise.
  finish: (input: OnboardingInput) => Promise<{ error: string } | undefined>;
};
