// What onboarding needs from the backend (RPC) and data-pipeline (site read, Maps) agents. Step 5 brief.
export type LocalPlace = { name: string; kind: "landmark" | "area" };
export type SiteRead = { name?: string; cuisine?: string; status: "ok" | "unreadable" };
export type MapsCompetitor = { name: string; domain?: string; rating?: number; cid: string };
export type CompetitorSearch = { status: "ok" | "missing_keys" | "error"; items: MapsCompetitor[] };
export type CompetitorQuery = { cuisine: string; city: string; state: string; domain: string };

export type OnboardingInput = {
  business: {
    name: string;
    domain: string;
    cuisine: string;
    city: string;
    state: string;
    country: string;
    aliases: string[];
  };
  competitors: {
    name: string;
    domain: string | null;
    rating: number | null;
    maps_cid: string | null;
    source: "maps" | "manual";
  }[];
  questions: {
    short_text: string;
    long_text: string;
    active_form: "short" | "long";
    active: boolean;
    location_level: "country" | "state" | "city";
    country: string;
    state: string | null;
    city: string | null;
    template_key: string;
  }[];
};

export type OnboardingActions = {
  readSite: (domain: string) => Promise<SiteRead>;
  findCompetitors: (q: CompetitorQuery) => Promise<CompetitorSearch>;
  // Redirects to /app on success; returns an error code otherwise.
  finish: (input: OnboardingInput) => Promise<{ error: string } | undefined>;
};
