import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureSelfServeWorkspace } from "@/lib/queries/auth";
import { listFixes, setFixStatus } from "@/lib/queries/fixes";
import { createBusinessOnboarding, createDfyClient } from "@/lib/queries/onboarding";
import { getPreviousRun, getRunResults } from "@/lib/queries/results";
import {
  addCompetitor,
  dismissSuggestion,
  getQuestionsWithLatestAnswers,
  listCompetitors,
  listRunSummaries,
} from "@/lib/queries/shell";
import { listDfyBusinesses } from "@/lib/queries/team";
import { anonClient, must, newUser, serviceClient, type TestUser } from "./helpers";

const loose = (db: unknown) => db as SupabaseClient;
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000).toISOString();

// Every table the team read policies cover, keyed by how a business's rows are found.
const TABLES = [
  "businesses",
  "competitors",
  "questions",
  "runs",
  "answers",
  "citations",
  "fixes",
  "fix_checks",
] as const;

type Seeded = {
  businessId: string;
  runId: string;
  prevRunId: string;
  answerId: string;
  fixId: string;
  questionId: string;
};

// Questions, two closed runs, answers with a citation, a competitor, an open fix and a fix check,
// written with the service role so the business can be DFY or self-serve.
async function seedData(businessId: string): Promise<Seeded> {
  const s = serviceClient();
  must(
    await s.from("fix_rules").upsert(
      {
        key: "R10",
        grp: "restaurant",
        title: "Rule R10",
        size: "M-L",
        cadence: "weekly",
        customer_copy: "Copy",
        enabled: true,
      },
      { onConflict: "key", ignoreDuplicates: true },
    ),
  );
  must(
    await s
      .from("competitors")
      .insert({ business_id: businessId, name: "Example Udon House", domain: "example-udon.test", source: "maps" }),
  );
  const q = must(
    await s
      .from("questions")
      .insert({
        business_id: businessId,
        short_text: "best pho in Irvine",
        location_level: "city",
        country: "US",
        state: "CA",
        city: "Irvine",
      })
      .select("id")
      .single(),
  );
  const run = async (h: number) =>
    must(
      await s
        .from("runs")
        .insert({
          business_id: businessId,
          kind: "weekly",
          status: "complete",
          jobs_total: 1,
          jobs_ok: 1,
          started_at: hoursAgo(h + 1),
          finished_at: hoursAgo(h),
        })
        .select("id")
        .single(),
    ).id as string;
  const prevRunId = await run(200);
  const runId = await run(2);
  const answer = must(
    await s
      .from("answers")
      .insert({
        run_id: runId,
        question_id: q.id,
        engine: "chatgpt",
        run_index: 1,
        status: "ok",
        text: "Example Pho Spot is great.",
        question_text_used: "best pho in Irvine",
        mentioned: true,
        brands: [{ name: "Example Pho Spot", kind: "business", mentioned: true, position: 1 }],
        raw: { vendor: "secret" },
      })
      .select("id")
      .single(),
  );
  must(
    await s.from("citations").insert({
      answer_id: answer.id,
      url: "https://www.yelp.com/biz/example",
      domain: "yelp.com",
      position: 1,
      category: "review_directory",
    }),
  );
  const fix = must(
    await s
      .from("fixes")
      .insert({
        business_id: businessId,
        rule_key: "R10",
        size: "M-L",
        title: "Rule R10",
        detail: "Your menu is a PDF.",
      })
      .select("id")
      .single(),
  );
  must(await s.from("fix_checks").insert({ run_id: runId, business_id: businessId, rule_key: "R10", result: "fix" }));
  return { businessId, runId, prevRunId, answerId: answer.id, fixId: fix.id, questionId: q.id };
}

async function rowsFor(db: unknown, table: (typeof TABLES)[number], d: Seeded) {
  const query = loose(db).from(table).select("*");
  const filtered =
    table === "businesses"
      ? query.eq("id", d.businessId)
      : table === "runs"
        ? query.eq("business_id", d.businessId)
        : table === "answers"
          ? query.eq("run_id", d.runId)
          : table === "citations"
            ? query.eq("answer_id", d.answerId)
            : query.eq("business_id", d.businessId);
  const { data, error } = await filtered;
  if (error) throw error;
  return data as unknown[];
}

let creator: TestUser;
let team: TestUser;
let client: TestUser;
let selfServeUser: TestUser;
let dfyA: Seeded;
let dfyB: Seeded;
let selfServe: Seeded;

const dfyBusiness = (name: string, domain: string) => ({
  name,
  domain,
  cuisine: "pho",
  city: "Irvine",
  state: "CA",
  country: "US",
  aliases: [],
});

beforeAll(async () => {
  const s = serviceClient();
  creator = await newUser("team-creator");
  team = await newUser("team-other");
  client = await newUser("team-dfy-client");
  must(
    await s.from("user_roles").insert([
      { user_id: creator.id, role: "team" },
      { user_id: team.id, role: "team" },
      { user_id: client.id, role: "dfy_client" },
    ]),
  );
  const a = await createDfyClient(creator.db, {
    workspace_name: "Example DFY A",
    business: dfyBusiness("Example Pho Spot", "example-pho.test"),
  });
  const b = await createDfyClient(creator.db, {
    workspace_name: "Example DFY B",
    business: dfyBusiness("Example Banh Mi Bar", "example-banhmi.test"),
  });
  must(await s.from("workspace_members").insert({ workspace_id: a.workspaceId, user_id: client.id, role: "member" }));
  dfyA = await seedData(a.businessId);
  dfyB = await seedData(b.businessId);

  selfServeUser = await newUser("team-self-serve");
  await ensureSelfServeWorkspace(selfServeUser.db);
  const ssId = await createBusinessOnboarding(selfServeUser.db, {
    business: {
      name: "Example Ramen House",
      domain: "example-ramen.test",
      cuisine: "ramen",
      city: "Irvine",
      state: "CA",
      country: "US",
      aliases: [],
    },
    competitors: [],
    questions: [],
  });
  selfServe = await seedData(ssId);
});

describe("team reads DFY data across workspaces it doesn't belong to", () => {
  it("sees every covered table for both DFY businesses", async () => {
    for (const d of [dfyA, dfyB]) {
      for (const table of TABLES) {
        const rows = await rowsFor(team.db, table, d);
        expect(rows.length, `${table} ${d.businessId}`).toBeGreaterThan(0);
      }
    }
  });

  it("listDfyBusinesses lists every DFY business by name, not self-serve ones", async () => {
    const ids = (await listDfyBusinesses(team.db)).map((b) => b.id);
    expect(ids).toEqual(expect.arrayContaining([dfyA.businessId, dfyB.businessId]));
    expect(ids).not.toContain(selfServe.businessId);
    const ours = (await listDfyBusinesses(team.db)).filter((b) => [dfyA.businessId, dfyB.businessId].includes(b.id));
    expect(ours.map((b) => b.name)).toEqual(["Example Banh Mi Bar", "Example Pho Spot"]);
    expect(ours[1]).toEqual({
      id: dfyA.businessId,
      name: "Example Pho Spot",
      domain: "example-pho.test",
      cuisine: "pho",
      city: "Irvine",
      state: "CA",
      country: "US",
      fix_list_visible: false,
    });
  });

  it("every query the team pages use returns the DFY data", async () => {
    const results = (await getRunResults(team.db, dfyA.runId))!;
    expect(results.label).toBe("Example Pho Spot");
    expect(results.brands.map((b) => b.name)).toEqual(["Example Pho Spot", "Example Udon House"]);
    expect(results.answers).toHaveLength(1);
    expect(results.citations.map((c) => c.domain)).toEqual(["yelp.com"]);
    expect(JSON.stringify(results)).not.toContain("secret");

    expect((await getPreviousRun(team.db, dfyA.businessId, dfyA.runId))?.run.id).toBe(dfyA.prevRunId);
    const summaries = await listRunSummaries(team.db, dfyA.businessId);
    expect(summaries.map((r) => r.id)).toEqual([dfyA.runId, dfyA.prevRunId]);
    expect(summaries[0].visibility).toEqual({ value: 1, numerator: 1, denominator: 1 });

    const questions = await getQuestionsWithLatestAnswers(team.db, dfyA.businessId);
    expect(questions.run?.id).toBe(dfyA.runId);
    expect(questions.questions[0].answers[0].citations[0]).toMatchObject({
      domain: "yelp.com",
      category: "review_directory",
    });

    expect((await listCompetitors(team.db, dfyA.businessId)).tracked.map((c) => c.name)).toEqual([
      "Example Udon House",
    ]);
    const fixes = await listFixes(team.db, dfyA.businessId);
    expect(fixes.ranked.map((f) => f.id)).toEqual([dfyA.fixId]);
    expect(fixes.lastRunId).toBe(dfyA.runId);
  });

  it("free audits stay invisible, even with a DFY business id", async () => {
    const s = serviceClient();
    const free = must(
      await s
        .from("runs")
        .insert({ kind: "free_audit", business_id: dfyA.businessId, status: "complete" })
        .select("id")
        .single(),
    );
    expect(must(await team.db.from("runs").select("id").eq("id", free.id))).toEqual([]);
    expect(await getRunResults(team.db, free.id)).toBeNull();
  });
});

describe("team cannot see self-serve data", () => {
  it("gets nothing for a self-serve business on any covered table", async () => {
    for (const table of TABLES) {
      expect(await rowsFor(team.db, table, selfServe), table).toEqual([]);
    }
    expect(await getRunResults(team.db, selfServe.runId)).toBeNull();
    expect(await listRunSummaries(team.db, selfServe.businessId)).toEqual([]);
    expect(await listFixes(team.db, selfServe.businessId)).toEqual({
      ranked: [],
      tidyUps: [],
      unchecked: [],
      lastRunId: null,
    });
  });
});

describe("no extra rows for anyone else", () => {
  it("a dfy_client sees only its own DFY business, and fixes only when visible", async () => {
    expect((await listDfyBusinesses(client.db)).map((b) => b.id)).toEqual([dfyA.businessId]);
    for (const table of TABLES) {
      expect(await rowsFor(client.db, table, dfyB), table).toEqual([]);
      expect(await rowsFor(client.db, table, selfServe), table).toEqual([]);
    }
    expect(await rowsFor(client.db, "fixes", dfyA)).toEqual([]);
    expect(await rowsFor(client.db, "fix_checks", dfyA)).toEqual([]);
    expect((await rowsFor(client.db, "runs", dfyA)).length).toBeGreaterThan(0);
  });

  it("a self-serve user sees no DFY rows; anon is refused", async () => {
    expect(await listDfyBusinesses(selfServeUser.db)).toEqual([]);
    for (const table of TABLES) expect(await rowsFor(selfServeUser.db, table, dfyA), table).toEqual([]);
    await expect(listDfyBusinesses(anonClient())).rejects.toMatchObject({ code: "42501" });
    for (const table of TABLES) {
      const { data, error } = await loose(anonClient()).from(table).select("*").limit(1);
      if (error) expect(error.code, table).toBe("42501");
      else expect(data, table).toEqual([]);
    }
  });
});

describe("team writes on DFY businesses (lead O1)", () => {
  it("a non-member team user sets fix status and adds/dismisses competitors on any DFY business", async () => {
    await setFixStatus(team.db, dfyB.fixId, "doing");
    expect(must(await serviceClient().from("fixes").select("status").eq("id", dfyB.fixId).single()).status).toBe(
      "doing",
    );
    const added = await addCompetitor(team.db, dfyB.businessId, { name: "Example Team Pick", source: "manual" });
    const dismissed = await dismissSuggestion(team.db, dfyB.businessId, {
      name: "Example Not Us",
      domain: "example-notus.test",
    });
    const list = await listCompetitors(team.db, dfyB.businessId);
    expect(list.tracked.map((c) => c.id)).toContain(added);
    expect(list.dismissed.map((c) => c.id)).toEqual([dismissed]);
  });

  it("a team user can't write a self-serve business, and a dfy_client never writes", async () => {
    await expect(setFixStatus(team.db, selfServe.fixId, "done")).rejects.toMatchObject({ code: "42501" });
    await expect(
      addCompetitor(team.db, selfServe.businessId, { name: "Example", source: "manual" }),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(dismissSuggestion(team.db, selfServe.businessId, { name: "Example" })).rejects.toMatchObject({
      code: "42501",
    });

    must(await serviceClient().from("businesses").update({ fix_list_visible: true }).eq("id", dfyA.businessId));
    await expect(setFixStatus(client.db, dfyA.fixId, "done")).rejects.toMatchObject({ code: "42501" });
    await expect(
      addCompetitor(client.db, dfyA.businessId, { name: "Example", source: "manual" }),
    ).rejects.toMatchObject({ code: "42501" });
    must(await serviceClient().from("businesses").update({ fix_list_visible: false }).eq("id", dfyA.businessId));
    expect(must(await serviceClient().from("fixes").select("status").eq("id", dfyA.fixId).single()).status).toBe(
      "todo",
    );
  });

  it("self-serve members still write their own business", async () => {
    await setFixStatus(selfServeUser.db, selfServe.fixId, "doing");
    await addCompetitor(selfServeUser.db, selfServe.businessId, { name: "Example Own Pick", source: "manual" });
  });
});
