import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";
import type { Database } from "@/types/db";

// Filled by playwright.config.ts from `supabase status` (local stack only).
const env = (name: string) => {
  const v = process.env[`SUPABASE_LOCAL_${name}`];
  if (!v) throw new Error(`Local Supabase is not running (missing ${name}). Run: pnpm exec supabase start`);
  return v;
};

export const admin = () =>
  createClient<Database>(env("API_URL"), env("SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

export async function newUser(tag: string, role?: "team" | "dfy_client") {
  const email = `${tag}-${randomUUID()}@example.test`;
  const { data, error } = await admin().auth.admin.createUser({ email, email_confirm: true });
  if (error) throw error;
  if (role) {
    const res = await admin().from("user_roles").insert({ user_id: data.user.id, role });
    if (res.error) throw res.error;
  }
  return { id: data.user.id, email };
}

// The admin API mints the same token a magic-link email carries; opening it is what clicking the email does.
export async function openMagicLink(page: Page, email: string, next?: string) {
  const { data, error } = await admin().auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const q = new URLSearchParams({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (next) q.set("next", next);
  await page.goto(`/auth/callback?${q}`);
}

export async function workspacesOwnedBy(userId: string) {
  const { data, error } = await admin().from("workspace_members").select("workspace_id, role").eq("user_id", userId);
  if (error) throw error;
  return data;
}
