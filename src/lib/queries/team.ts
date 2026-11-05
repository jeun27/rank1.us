import type { DbClient } from "./client";

export type DfyBusiness = {
  id: string;
  name: string;
  domain: string | null;
  cuisine: string | null;
  city: string;
  state: string;
  country: string;
  fix_list_visible: boolean;
};

// Active DFY businesses the caller can read, by name. Through RLS a team user gets every DFY
// business; anyone else only the DFY businesses of their own workspace (a dfy_client: theirs).
export async function listDfyBusinesses(db: DbClient): Promise<DfyBusiness[]> {
  const { data, error } = await db
    .from("businesses")
    .select("id, name, domain, cuisine, city, state, country, fix_list_visible")
    .eq("service", "dfy")
    .is("archived_at", null)
    .order("name")
    .order("id");
  if (error) throw error;
  return data;
}
