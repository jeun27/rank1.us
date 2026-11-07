// What onboarding uses from the backend (#20 queries) and data-pipeline (#23 site read, Maps). Step 5 brief.
import type { FindLocalCompetitorsInput, LocalCompetitor, LocalCompetitorsResult, SiteProfile } from "@/lib/onboarding";
import type { SiteServices } from "@/lib/onboarding/site-profile";
import type { OnboardingInput } from "@/lib/queries/onboarding";

import type { LocalPlace } from "@/lib/queries/places";
export type { LocalPlace };
export type { OnboardingInput, SiteProfile, SiteServices };
export type MapsCompetitor = LocalCompetitor;
export type CompetitorQuery = FindLocalCompetitorsInput & { domain: string };
// What the browser gets: the status and items, never the upstream error text.
export type CompetitorSearch = Omit<LocalCompetitorsResult, "error">;

export type OnboardingActions = {
  // UI2: the reading log's two real stages. readHome = open, business details, title (1–3); readServices = 4.
  readHome: (domain: string) => Promise<SiteProfile>;
  readServices: (domain: string) => Promise<SiteServices>;
  // UI3: the landmarks and areas Rank1 knows for the card's city (none = the pickers stay hidden).
  places: (city: string, state: string) => Promise<LocalPlace[]>;
  findCompetitors: (q: CompetitorQuery) => Promise<CompetitorSearch>;
  // Redirects to /app (or the C-b connect step) on success; returns an error code otherwise.
  finish: (input: OnboardingInput) => Promise<{ error: string } | undefined>;
};
