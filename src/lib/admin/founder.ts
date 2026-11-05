import "server-only";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isFounder } from "./is-founder";

// 404 for anyone but FOUNDER_EMAIL. Proxy already 404s others with a real status; this getUser()
// check (verified with Auth) is the authoritative gate for the page and its server action.
export async function requireFounder() {
  await connection();
  const { data } = await (await createClient()).auth.getUser();
  if (!isFounder(data.user?.email)) notFound();
  return data.user!;
}
