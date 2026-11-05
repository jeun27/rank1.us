import type { Tables } from "@/types/db";
import type { DbClient } from "./client";

type Business = Tables<"businesses">;
type Competitor = Tables<"competitors">;
type Question = Tables<"questions">;

// Shape of create_business_onboarding's jsonb argument. Only these fields are read.
export type OnboardingInput = {
  business: Pick<Business, "name" | "domain" | "cuisine" | "city" | "state" | "country" | "aliases">;
  competitors: (Pick<Competitor, "name"> &
    Partial<Pick<Competitor, "domain" | "rating" | "maps_cid">> & { source: "maps" | "manual" })[];
  questions: (Pick<Question, "short_text" | "long_text" | "active" | "template_key"> & {
    active_form: "short" | "long";
    location_level: "country" | "state" | "city";
  } & Partial<Pick<Question, "country" | "state" | "city">>)[];
};

export type DfyClientInput = { workspace_name: string; business: OnboardingInput["business"] };

// Creates the business, its competitors and questions in the caller's own workspace, in one
// transaction. Returns the business id. Errors: 42501 not allowed, 23514 a limit or check.
export async function createBusinessOnboarding(db: DbClient, input: OnboardingInput): Promise<string> {
  const { data, error } = await db.rpc("create_business_onboarding", { p: input });
  if (error) throw error;
  return data;
}

// Team only: a new client workspace (owned by the team caller) with one dfy business.
export async function createDfyClient(
  db: DbClient,
  input: DfyClientInput,
): Promise<{ workspaceId: string; businessId: string }> {
  const { data, error } = await db.rpc("create_dfy_client", { p: input });
  if (error) throw error;
  const { workspace_id, business_id } = data as { workspace_id: string; business_id: string };
  return { workspaceId: workspace_id, businessId: business_id };
}

export type OnboardingState = { workspaceId: string | null; hasActiveBusiness: boolean };

// The caller's own workspace (oldest membership) and whether it already has an active business.
export async function getOnboardingState(db: DbClient): Promise<OnboardingState> {
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return { workspaceId: null, hasActiveBusiness: false };
  const { data: member, error } = await db
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", auth.user.id)
    .order("created_at")
    .order("workspace_id")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!member) return { workspaceId: null, hasActiveBusiness: false };
  const { count, error: countError } = await db
    .from("businesses")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", member.workspace_id)
    .is("archived_at", null);
  if (countError) throw countError;
  return { workspaceId: member.workspace_id, hasActiveBusiness: (count ?? 0) > 0 };
}
