import type { DbClient } from "./client";

export type LocalPlace = { name: string; kind: "landmark" | "area" };

// Verified landmarks and areas for a city (onboarding picks), by kind then name.
export async function listLocalPlaces(db: DbClient, city: string, state: string): Promise<LocalPlace[]> {
  const { data, error } = await db
    .from("local_places")
    .select("name, kind")
    .eq("city", city)
    .eq("state", state)
    .eq("verified", true)
    .order("kind")
    .order("name");
  if (error) throw error;
  return data as LocalPlace[];
}
