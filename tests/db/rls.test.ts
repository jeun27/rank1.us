import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { anonClient, makeWorkspace, must, newUser, serviceClient, type Fixture, type TestUser } from "./helpers";

// Table names come from lists below, so these checks use an untyped client.
const loose = (db: unknown) => db as SupabaseClient;
const RLS_DENIED = "42501";

let a: TestUser;
let b: TestUser;
let fa: Fixture;
let fb: Fixture;
let freeAudit: { runId: string; ownedRunId: string; answerId: string; citationId: string };

beforeAll(async () => {
  a = await newUser("user-a");
  b = await newUser("user-b");
  fa = await makeWorkspace(a);
  fb = await makeWorkspace(b);

  const s = serviceClient();
  must(await s.from("domain_categories").upsert({ domain: "example-rls.test", category: "other", source: "rule" }));
  must(await s.from("question_templates").insert({ short_form: "best {cuisine} in {city}", long_form: "Where is the best {cuisine} in {city}?" }));
  must(await s.from("local_places").insert({ city: "Irvine", state: "CA", name: "Example Park", kind: "landmark" }));
  must(await s.from("leads").insert({ email: "lead@example.test", token: crypto.randomUUID() }));
  must(await s.from("contact_requests").insert({ name: "Example", email: "contact@example.test", industry: "Restaurant" }));
  must(await s.from("stripe_events").insert({ event_id: `evt_${crypto.randomUUID()}`, type: "checkout.session.completed" }));

  // free_audit runs: one with no business, one pointing at A's business. Neither is member-readable.
  const run = must(await s.from("runs").insert({ kind: "free_audit" }).select().single());
  const owned = must(await s.from("runs").insert({ kind: "free_audit", business_id: fa.businessId }).select().single());
  const ans = must(await s.from("answers").insert({ run_id: owned.id, engine: "gemini", run_index: 1, status: "ok", question_text_used: "best ramen in Irvine" }).select().single());
  const cit = must(await s.from("citations").insert({ answer_id: ans.id, url: "https://example.test/a", domain: "example.test" }).select().single());
  freeAudit = { runId: run.id, ownedRunId: owned.id, answerId: ans.id, citationId: cit.id };
});

type Spec = {
  table: string;
  match: (f: Fixture) => Record<string, string>;
  update: Record<string, unknown>;
  insert: (f: Fixture) => Record<string, unknown>;
};

// Every table holding a workspace's rows.
const WORKSPACE_TABLES: Spec[] = [
  { table: "workspaces", match: (f) => ({ id: f.workspaceId }), update: { name: "hacked" }, insert: () => ({ name: "x", owner_id: b.id }) },
  { table: "workspace_members", match: (f) => ({ workspace_id: f.workspaceId }), update: { role: "member" }, insert: (f) => ({ workspace_id: f.workspaceId, user_id: a.id, role: "owner" }) },
  { table: "businesses", match: (f) => ({ id: f.businessId }), update: { name: "hacked" }, insert: (f) => ({ workspace_id: f.workspaceId, name: "x" }) },
  { table: "competitors", match: (f) => ({ id: f.competitorId }), update: { name: "hacked" }, insert: (f) => ({ business_id: f.businessId, name: "x", source: "manual" }) },
  { table: "questions", match: (f) => ({ id: f.questionId }), update: { short_text: "hacked" }, insert: (f) => ({ business_id: f.businessId, short_text: "x", location_level: "city" }) },
  { table: "runs", match: (f) => ({ id: f.runId }), update: { status: "failed" }, insert: (f) => ({ business_id: f.businessId, kind: "weekly" }) },
  { table: "answers", match: (f) => ({ id: f.answerId }), update: { mentioned: false }, insert: (f) => ({ run_id: f.runId, engine: "chatgpt", run_index: 2, status: "ok", question_text_used: "x" }) },
  { table: "citations", match: (f) => ({ id: f.citationId }), update: { url: "https://hacked.test" }, insert: (f) => ({ answer_id: f.answerId, url: "https://x.test", domain: "x.test" }) },
  { table: "listing_snapshots", match: (f) => ({ id: f.snapshotId }), update: { url: "https://hacked.test" }, insert: (f) => ({ business_id: f.businessId, source: "yelp" }) },
  { table: "ai_traffic", match: (f) => ({ business_id: f.businessId }), update: { sessions: 999 }, insert: (f) => ({ business_id: f.businessId, date: "2026-11-02", source: "x", sessions: 1 }) },
  { table: "fixes", match: (f) => ({ id: f.fixId }), update: { title: "hacked" }, insert: (f) => ({ business_id: f.businessId, rule_key: "R1", size: "S", title: "x" }) },
  { table: "experiments", match: (f) => ({ id: f.experimentId }), update: { name: "hacked" }, insert: (f) => ({ business_id: f.businessId, name: "x" }) },
  { table: "experiment_questions", match: (f) => ({ experiment_id: f.experimentId }), update: { grp: "control" }, insert: (f) => ({ experiment_id: f.experimentId, question_id: f.question2Id, grp: "test" }) },
  { table: "reports", match: (f) => ({ id: f.reportId }), update: { status: "hacked" }, insert: (f) => ({ business_id: f.businessId, period_start: "2026-09-01", period_end: "2026-09-30" }) },
  { table: "google_tokens", match: (f) => ({ business_id: f.businessId }), update: { scope: "hacked" }, insert: (f) => ({ business_id: f.businessId, refresh_token_enc: "x" }) },
];

const ENGINE_TABLES = WORKSPACE_TABLES.filter((t) => ["runs", "answers", "citations", "listing_snapshots", "ai_traffic"].includes(t.table));
const SERVICE_ONLY = ["google_tokens", "leads", "contact_requests", "stripe_events", "fix_rules"];
const SIGNED_IN_READ = ["question_templates", "local_places", "domain_categories"];
const ALL_RELATIONS = [...WORKSPACE_TABLES.map((t) => t.table), "leads", "contact_requests", "stripe_events", "fix_rules", "fix_rules_public", ...SIGNED_IN_READ];

async function serviceRows(table: string, match: Record<string, string>) {
  return must(await loose(serviceClient()).from(table).select("*").match(match)) as Record<string, unknown>[];
}

describe("user A against user B's workspace", () => {
  for (const spec of WORKSPACE_TABLES) {
    describe(spec.table, () => {
      it("cannot read", async () => {
        const { data, error } = await loose(a.db).from(spec.table).select("*").match(spec.match(fb));
        expect(error).toBeNull();
        expect(data).toEqual([]);
      });

      it("cannot insert", async () => {
        const { error } = await loose(a.db).from(spec.table).insert(spec.insert(fb));
        expect(error?.code).toBe(RLS_DENIED);
      });

      it("cannot update", async () => {
        const before = await serviceRows(spec.table, spec.match(fb));
        const { data } = await loose(a.db).from(spec.table).update(spec.update).match(spec.match(fb)).select();
        expect(data ?? []).toEqual([]);
        expect(await serviceRows(spec.table, spec.match(fb))).toEqual(before);
      });

      it("cannot delete", async () => {
        const before = await serviceRows(spec.table, spec.match(fb));
        expect(before.length).toBeGreaterThan(0);
        const { data } = await loose(a.db).from(spec.table).delete().match(spec.match(fb)).select();
        expect(data ?? []).toEqual([]);
        expect(await serviceRows(spec.table, spec.match(fb))).toEqual(before);
      });
    });
  }
});

describe("anon", () => {
  for (const table of ALL_RELATIONS) {
    it(`gets nothing from ${table}`, async () => {
      const { data, error } = await loose(anonClient()).from(table).select("*");
      if (error) expect(error.code).toBe(RLS_DENIED);
      else expect(data).toEqual([]);
    });

    it(`cannot insert into ${table}`, async () => {
      const { error } = await loose(anonClient()).from(table).insert({});
      expect(error?.code).toBe(RLS_DENIED);
    });
  }
});

describe("members on their own workspace", () => {
  it("read and write member tables", async () => {
    const comp = must(await a.db.from("competitors").insert({ business_id: fa.businessId, name: "Example Pho", source: "suggested" }).select().single());
    must(await a.db.from("competitors").update({ hidden: true }).eq("id", comp.id));
    must(await a.db.from("competitors").delete().eq("id", comp.id));
    expect(must(await a.db.from("businesses").select("id").eq("id", fa.businessId))).toHaveLength(1);
  });

  for (const spec of ENGINE_TABLES) {
    it(`read ${spec.table} but cannot write it`, async () => {
      const own = must(await loose(a.db).from(spec.table).select("*").match(spec.match(fa)));
      expect(own.length).toBeGreaterThan(0);

      const { error } = await loose(a.db).from(spec.table).insert(spec.insert(fa));
      expect(error?.code).toBe(RLS_DENIED);

      const before = await serviceRows(spec.table, spec.match(fa));
      const upd = await loose(a.db).from(spec.table).update(spec.update).match(spec.match(fa)).select();
      expect(upd.data ?? []).toEqual([]);
      const del = await loose(a.db).from(spec.table).delete().match(spec.match(fa)).select();
      expect(del.data ?? []).toEqual([]);
      expect(await serviceRows(spec.table, spec.match(fa))).toEqual(before);
    });
  }

  it("cannot read free_audit runs, answers or citations, even on their own business", async () => {
    expect(must(await a.db.from("runs").select("id").in("id", [freeAudit.runId, freeAudit.ownedRunId]))).toEqual([]);
    expect(must(await a.db.from("answers").select("id").eq("id", freeAudit.answerId))).toEqual([]);
    expect(must(await a.db.from("citations").select("id").eq("id", freeAudit.citationId))).toEqual([]);
  });
});

describe("service-only tables", () => {
  for (const table of SERVICE_ONLY) {
    it(`${table}: signed-in users read nothing and cannot write`, async () => {
      expect(must(await loose(a.db).from(table).select("*"))).toEqual([]);
      const { error } = await loose(a.db).from(table).insert({});
      expect(error?.code).toBe(RLS_DENIED);
    });
  }

  it("fix_rules_public shows rules without why_note", async () => {
    const rows = must(await a.db.from("fix_rules_public").select("*").eq("key", "R1"));
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty("why_note");
    const { error } = await loose(a.db).from("fix_rules_public").select("why_note");
    expect(error).not.toBeNull();
  });
});

describe("reference tables", () => {
  for (const table of SIGNED_IN_READ) {
    it(`${table}: signed-in users read, cannot write`, async () => {
      expect(must(await loose(a.db).from(table).select("*")).length).toBeGreaterThan(0);
      const { error } = await loose(a.db).from(table).insert({});
      expect(error?.code).toBe(RLS_DENIED);
    });
  }
});

describe("workspace billing fields", () => {
  for (const field of ["seats_quantity", "stripe_customer_id", "stripe_subscription_id", "subscription_status"]) {
    it(`owner cannot update ${field} on their own workspace`, async () => {
      const value = field === "seats_quantity" ? 99 : "hacked";
      const { error } = await loose(a.db).from("workspaces").update({ [field]: value }).eq("id", fa.workspaceId);
      expect(error?.code).toBe(RLS_DENIED);
      const [row] = await serviceRows("workspaces", { id: fa.workspaceId });
      expect(row[field]).not.toBe(value);
    });
  }

  it("owner can rename their workspace", async () => {
    const rows = must(await a.db.from("workspaces").update({ name: "Example Group" }).eq("id", fa.workspaceId).select());
    expect(rows[0].name).toBe("Example Group");
  });

  it("a user can create a workspace and becomes its owner, but cannot set billing fields", async () => {
    const ws = must(await a.db.from("workspaces").insert({ name: "Example Second", owner_id: a.id }).select().single());
    expect(ws.seats_quantity).toBe(0);
    const members = must(await a.db.from("workspace_members").select("user_id, role").eq("workspace_id", ws.id));
    expect(members).toEqual([{ user_id: a.id, role: "owner" }]);

    const { error } = await loose(a.db).from("workspaces").insert({ name: "x", owner_id: a.id, seats_quantity: 5 });
    expect(error?.code).toBe(RLS_DENIED);
  });
});
