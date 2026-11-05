import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";
import type { DbClient } from "@/lib/queries/client";

const env = (name: string) => {
  const v = process.env[`SUPABASE_LOCAL_${name}`];
  if (!v) throw new Error(`Local Supabase is not running (missing ${name}). Run: pnpm exec supabase start`);
  return v;
};

const opts = { auth: { persistSession: false, autoRefreshToken: false } };

export const dbUrl = () => env("DB_URL");
export const apiUrl = () => env("API_URL");
export const serviceClient = (): DbClient => createClient<Database>(env("API_URL"), env("SERVICE_ROLE_KEY"), opts);
export const anonClient = (): DbClient => createClient<Database>(env("API_URL"), env("ANON_KEY"), opts);

export type TestUser = { id: string; email: string; db: DbClient };

// A real auth user, created with the admin API and signed in with a password.
export async function newUser(tag: string): Promise<TestUser> {
  const email = `${tag}-${randomUUID()}@example.test`;
  const password = randomUUID();
  const { data, error } = await serviceClient().auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const db = anonClient();
  const signIn = await db.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { id: data.user.id, email, db };
}

// Throws on error, returns data. For service-role setup only.
export function must<T>(res: { data: T; error: unknown }): NonNullable<T> {
  if (res.error) throw res.error;
  return res.data as NonNullable<T>;
}

export type Fixture = {
  workspaceId: string;
  businessId: string;
  competitorId: string;
  questionId: string;
  question2Id: string;
  runId: string;
  answerId: string;
  citationId: string;
  snapshotId: string;
  fixId: string;
  experimentId: string;
  reportId: string;
};

// One row in every workspace-scoped table, owned by `owner`. Written with the service role.
export async function makeWorkspace(owner: TestUser): Promise<Fixture> {
  const s = serviceClient();
  must(await s.from("fix_rules").upsert(
    { key: "R1", grp: "restaurant", title: "Test rule", size: "S", cadence: "weekly", customer_copy: "Test copy", why_note: "secret" },
    { onConflict: "key", ignoreDuplicates: true },
  ));
  const ws = must(await s.from("workspaces").insert({ name: "Example data", owner_id: owner.id, seats_quantity: 1 }).select().single());
  const biz = must(await s.from("businesses").insert({ workspace_id: ws.id, name: "Example Noodle House" }).select().single());
  const comp = must(await s.from("competitors").insert({ business_id: biz.id, name: "Example Taco Bar", source: "manual" }).select().single());
  const q = must(await s.from("questions").insert({ business_id: biz.id, short_text: "best ramen in Irvine", location_level: "city", city: "Irvine" }).select().single());
  const q2 = must(await s.from("questions").insert({ business_id: biz.id, short_text: "late night food Irvine", location_level: "city", active: false }).select().single());
  const run = must(await s.from("runs").insert({ business_id: biz.id, kind: "weekly", status: "complete", started_at: "2026-11-01T00:00:00Z" }).select().single());
  const ans = must(await s.from("answers").insert({ run_id: run.id, question_id: q.id, engine: "chatgpt", run_index: 1, status: "ok", question_text_used: q.short_text, mentioned: true }).select().single());
  const cit = must(await s.from("citations").insert({ answer_id: ans.id, url: "https://www.yelp.com/biz/example", domain: "yelp.com" }).select().single());
  const snap = must(await s.from("listing_snapshots").insert({ business_id: biz.id, source: "gbp" }).select().single());
  must(await s.from("ai_traffic").insert({ business_id: biz.id, date: "2026-11-01", source: "chatgpt.com", sessions: 3 }));
  const fix = must(await s.from("fixes").insert({ business_id: biz.id, rule_key: "R1", size: "S", title: "Fix profile" }).select().single());
  const exp = must(await s.from("experiments").insert({ business_id: biz.id, name: "Menu test" }).select().single());
  must(await s.from("experiment_questions").insert({ experiment_id: exp.id, question_id: q.id, grp: "test" }));
  const rep = must(await s.from("reports").insert({ business_id: biz.id, period_start: "2026-10-01", period_end: "2026-10-31" }).select().single());
  must(await s.from("google_tokens").insert({ business_id: biz.id, refresh_token_enc: "enc", scope: "analytics.readonly" }));
  return {
    workspaceId: ws.id, businessId: biz.id, competitorId: comp.id, questionId: q.id, question2Id: q2.id,
    runId: run.id, answerId: ans.id, citationId: cit.id, snapshotId: snap.id, fixId: fix.id,
    experimentId: exp.id, reportId: rep.id,
  };
}

// `supabase db reset` re-applies migrations and supabase/seed.sql, then restarts the API containers.
export async function resetDb() {
  execSync("pnpm exec supabase db reset", { stdio: "pipe" });
  for (let i = 0; i < 60; i++) {
    try {
      const [auth, rest] = await Promise.all([fetch(`${apiUrl()}/auth/v1/health`), fetch(`${apiUrl()}/rest/v1/`)]);
      if (auth.status < 500 && rest.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Supabase API did not come back after db reset");
}
