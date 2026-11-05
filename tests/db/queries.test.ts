import { beforeAll, describe, expect, it } from "vitest";
import { getCurrentWorkspace } from "@/lib/queries/workspaces";
import { listBusinesses } from "@/lib/queries/businesses";
import { listQuestionsByBusiness } from "@/lib/queries/questions";
import { getLatestRunSummary } from "@/lib/queries/runs";
import { anonClient, makeWorkspace, must, newUser, serviceClient, type Fixture, type TestUser } from "./helpers";

let a: TestUser;
let b: TestUser;
let fa: Fixture;
let fb: Fixture;

beforeAll(async () => {
  a = await newUser("queries-a");
  b = await newUser("queries-b");
  fa = await makeWorkspace(a);
  fb = await makeWorkspace(b);
});

describe("getCurrentWorkspace", () => {
  it("returns the user's workspace", async () => {
    expect((await getCurrentWorkspace(a.db))?.id).toBe(fa.workspaceId);
  });

  it("returns null when signed out", async () => {
    expect(await getCurrentWorkspace(anonClient())).toBeNull();
  });
});

describe("listBusinesses", () => {
  it("lists active businesses, not archived ones or another workspace's", async () => {
    const s = serviceClient();
    must(await s.from("workspaces").update({ seats_quantity: 2 }).eq("id", fa.workspaceId));
    const archived = must(await s.from("businesses").insert({ workspace_id: fa.workspaceId, name: "Example Closed" }).select().single());
    must(await s.from("businesses").update({ archived_at: new Date().toISOString() }).eq("id", archived.id));

    expect((await listBusinesses(a.db, fa.workspaceId)).map((x) => x.id)).toEqual([fa.businessId]);
    expect(await listBusinesses(a.db, fb.workspaceId)).toEqual([]);
  });
});

describe("listQuestionsByBusiness", () => {
  it("lists the business's questions, active first", async () => {
    const qs = await listQuestionsByBusiness(a.db, fa.businessId);
    expect(qs.map((q) => q.id)).toEqual([fa.questionId, fa.question2Id]);
    expect(await listQuestionsByBusiness(a.db, fb.businessId)).toEqual([]);
  });
});

describe("getLatestRunSummary", () => {
  it("summarizes the latest run; failed and no_overview answers are out of the denominator", async () => {
    const s = serviceClient();
    const run = must(await s.from("runs").insert({
      business_id: fa.businessId, kind: "weekly", status: "partial", jobs_total: 6, jobs_ok: 4, jobs_failed: 1,
      started_at: "2026-11-04T00:00:00Z", finished_at: "2026-11-04T01:00:00Z",
    }).select().single());
    const answer = (status: "ok" | "failed" | "no_overview", mentioned: boolean | null, run_index: number) => ({
      run_id: run.id, question_id: fa.questionId, engine: "chatgpt", run_index, status, mentioned, question_text_used: "best ramen in Irvine",
    });
    must(await s.from("answers").insert([
      answer("ok", true, 1), answer("ok", true, 2), answer("ok", true, 3), answer("ok", false, 1),
      answer("failed", null, 2), { ...answer("no_overview", null, 1), engine: "google_aio" },
    ]));

    expect(await getLatestRunSummary(a.db, fa.businessId)).toEqual({
      id: run.id, status: "partial", jobs_ok: 4, jobs_total: 6, finished_at: "2026-11-04T01:00:00+00:00",
      visibility: { value: 0.75, numerator: 3, denominator: 4 },
    });
  });

  it("gives a null value when the run has no successful answers", async () => {
    const s = serviceClient();
    const run = must(await s.from("runs").insert({ business_id: fa.businessId, kind: "weekly", status: "failed", started_at: "2026-11-05T00:00:00Z" }).select().single());
    must(await s.from("answers").insert({ run_id: run.id, engine: "perplexity", run_index: 1, status: "failed", question_text_used: "x" }));
    const summary = await getLatestRunSummary(a.db, fa.businessId);
    expect(summary?.id).toBe(run.id);
    expect(summary?.visibility).toEqual({ value: null, numerator: 0, denominator: 0 });
  });

  it("returns null with no runs, or for another workspace's business", async () => {
    const s = serviceClient();
    must(await s.from("workspaces").update({ seats_quantity: 3 }).eq("id", fa.workspaceId));
    const fresh = must(await s.from("businesses").insert({ workspace_id: fa.workspaceId, name: "Example Fresh" }).select().single());
    expect(await getLatestRunSummary(a.db, fresh.id)).toBeNull();
    expect(await getLatestRunSummary(a.db, fb.businessId)).toBeNull();
  });
});
