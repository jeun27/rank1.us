// Onboarding data contract (Step 5). The frontend builds against these; change them only with the lead.
import type { Vertical } from "@/lib/queries/onboarding";
import type { BuiltQuestion, Business, Picks } from "@/lib/questions/templates";

export type SiteRead = { name?: string; cuisine?: string; status: "ok" | "unreadable" };

// Onboarding v2 (DP1): the business profile read from the home page. Empty fields stay empty (no
// Irvine default); each filled field has its source (a user edit later turns it into "user").
export type ProfileSource = "schema" | "meta" | "title" | "nav" | "sitemap" | "default" | "user";
type ProfileField =
  "name" | "vertical" | "category" | "cuisine" | "city" | "state" | "address" | "phone" | "areaServed" | "sameAs";
export type SiteProfile = SiteRead & {
  vertical?: Vertical;
  category?: string;
  city?: string;
  state?: string;
  address?: string;
  phone?: string;
  areaServed: string[];
  // Profile links (Google Business Profile, Yelp, YouTube…), for Connections hints and the G1 channel.
  sameAs: string[];
  sources: Partial<Record<ProfileField, ProfileSource>>;
};

export type LocalCompetitor = { name: string; domain?: string; rating?: number; cid: string };

export type LocalCompetitorsResult = {
  status: "ok" | "missing_keys" | "error";
  // Maps order, top 5, the business itself excluded. Empty unless status is 'ok'.
  items: LocalCompetitor[];
  error?: string;
};

// limit: how many Maps results to keep (default 5); the shared cache keeps up to 20.
export type FindLocalCompetitorsInput = {
  cuisine: string;
  city: string;
  state: string;
  domain?: string;
  limit?: number;
};

export type SuggestQuestionsInput = { business: Business; picks: Picks };
export type { BuiltQuestion, Business, Picks };
