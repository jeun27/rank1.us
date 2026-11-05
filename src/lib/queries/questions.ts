import type { Tables } from "@/types/db";
import type { DbClient } from "./client";

export type Question = Tables<"questions">;

// All questions of a business, active first.
export async function listQuestionsByBusiness(db: DbClient, businessId: string): Promise<Question[]> {
  const { data, error } = await db
    .from("questions")
    .select("*")
    .eq("business_id", businessId)
    .order("active", { ascending: false })
    .order("short_text");
  if (error) throw error;
  return data;
}
