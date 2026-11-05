// Onboarding data contract (Step 5). The frontend builds against these; change them only with the lead.
import type { BuiltQuestion, Business, Picks } from "@/lib/questions/templates";

export type SiteRead = { name?: string; cuisine?: string; status: "ok" | "unreadable" };

export type LocalCompetitor = { name: string; domain?: string; rating?: number; cid: string };

export type LocalCompetitorsResult = {
  status: "ok" | "missing_keys" | "error";
  // Maps order, top 5, the business itself excluded. Empty unless status is 'ok'.
  items: LocalCompetitor[];
  error?: string;
};

export type FindLocalCompetitorsInput = { cuisine: string; city: string; state: string; domain?: string };

export type SuggestQuestionsInput = { business: Business; picks: Picks };
export type { BuiltQuestion, Business, Picks };
