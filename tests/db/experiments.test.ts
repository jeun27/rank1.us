import { beforeAll, describe, expect, it } from "vitest";
import { createDfyClient } from "@/lib/queries/onboarding";
import {
  createExperiment,
  deleteExperiment,
  endExperiment,
  getExperimentData,
  laToday,
  listExperiments,
} from "@/lib/queries/experiments";
import { makeWorkspace, must, newUser, serviceClient, type Fixture, type TestUser } from "./helpers";

// Step 17 before/after test vs control. Windows on the LA date of runs.started_at:
// before [d-28, d), after [d, d+28), cut at the LA date of ended_at (end day included).
const addDays = (date: string, days: number) => {
  const t = new Date(`${date}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
};
// Noon in Los Angeles is the same LA date whether the offset is -07 or -08.
const laNoon = (date: string) => `${date}T12:00:00-08:00`;
// The UTC instant of 00:00 in Los Angeles on `date` (PDT or PST).
const laMidnight = (date: string) => {
  const offset = ["-07:00", "-08:00"].find((o) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
      hourCycle: "h23",
      hour: "2-digit",
    }).format(new Date(`${date}T00:00:00${o}`));
    return parts === "00";
  })!;
  return new Date(`${date}T00:00:00${offset}`);
};

let owner: TestUser;
let f: Fixture;
let other: Fixture;
let outsider: TestUser;
let team: TestUser;
let client: TestUser;
let dfy: { workspaceId: string; businessId: string };
let q1: string;
let q2: string;
let q3: string;
let q4: string;
let inactive: string;
let dfyQ: string[];
const d = addDays(laToday(), -60);

const question = async (businessId: string, text: string, active = true) =>
  must(
    await serviceClient()
      .from("questions")
      .insert({ business_id: businessId, short_text: text, location_level: "city", city: "Irvine", active })
      .select("id")
      .single(),
  ).id;

// One run on `date` (noon LA) or at an exact instant, with an answer per entry: [question, status, mentioned].
async function run(
  businessId: string,
  at: string | Date,
  answers: [string, "ok" | "failed", boolean][],
  kind = "weekly",
) {
  const s = serviceClient();
  const started = typeof at === "string" ? laNoon(at) : at.toISOString();
  const r = must(
    await s
      .from("runs")
      .insert({ business_id: businessId, kind, status: "complete", started_at: started })
      .select("id")
      .single(),
  );
  must(
    await s.from("answers").insert(
      answers.map(([question_id, status, mentioned], i) => ({
        run_id: r.id,
        question_id,
        engine: i % 2 ? "gemini" : "chatgpt",
        run_index: i + 1,
        status,
        mentioned,
        checked_at: started,
        question_text_used: "best ramen in Irvine",
      })),
    ),
  );
}

beforeAll(async () => {
  owner = await newUser("exp-owner");
  f = await makeWorkspace(owner);
  other = await makeWorkspace(owner);
  outsider = await newUser("exp-outsider");
  q1 = await question(f.businessId, "ramen near me");
  q2 = await question(f.businessId, "noodles open late");
  q3 = await question(f.businessId, "tonkotsu Irvine");
  q4 = await question(f.businessId, "ramen delivery Irvine");
  inactive = f.question2Id;

  team = await newUser("exp-team");
  client = await newUser("exp-client");
  must(
    await serviceClient()
      .from("user_roles")
      .insert([
        { user_id: team.id, role: "team" },
        { user_id: client.id, role: "dfy_client" },
      ]),
  );
  dfy = await createDfyClient(team.db, {
    workspace_name: "Example DFY",
    business: {
      name: "Example Pho Spot",
      domain: "example-pho.test",
      cuisine: "pho",
      city: "Irvine",
      state: "CA",
      country: "US",
      aliases: [],
    },
  });
  must(
    await serviceClient()
      .from("workspace_members")
      .insert({ workspace_id: dfy.workspaceId, user_id: client.id, role: "member" }),
  );
  dfyQ = [await question(dfy.businessId, "pho near me"), await question(dfy.businessId, "pho open late")];

  // q1 (test): 2 ok answers (1 named) and 1 failed per run. q2 (control): 1 ok, not named.
  for (const day of [-29, -28, -1, 0, 5, 6, 27, 28]) {
    await run(f.businessId, addDays(d, day), [
      [q1, "ok", true],
      [q1, "ok", false],
      [q1, "failed", true],
      [q2, "ok", false],
    ]);
  }
  await run(f.businessId, addDays(d, 1), [[q1, "ok", true]], "free_audit");
  await run(f.businessId, addDays(d, -3), [[q3, "ok", true]]);
  // The UTC trap: one minute before LA midnight on d is still d-1 (before); midnight is d (after).
  await run(f.businessId, new Date(laMidnight(d).getTime() - 60_000), [[q4, "ok", true]]);
  await run(f.businessId, laMidnight(d), [[q4, "ok", false]]);
});

describe("role gate", () => {
  it("self-serve members create, list, end and delete experiments", async () => {
    const id = await createExperiment(owner.db, { businessId: f.businessId, test: [q1], name: "Menu page" });
    const listed = await listExperiments(owner.db, f.businessId);
    expect(listed.find((e) => e.id === id)).toMatchObject({ name: "Menu page", status: "running", test: 1 });
    expect(await endExperiment(owner.db, id)).toBe(true);
    expect(await endExperiment(owner.db, id)).toBe(false);
    expect((await listExperiments(owner.db, f.businessId)).find((e) => e.id === id)?.status).toBe("ended");
    expect(await deleteExperiment(owner.db, id)).toBe(true);
    expect(must(await serviceClient().from("experiments").select("id").eq("id", id))).toEqual([]);
  });

  it("the team creates, reads, ends and deletes on a DFY business", async () => {
    const id = await createExperiment(team.db, { businessId: dfy.businessId, test: [dfyQ[0]], name: "Hours" });
    expect((await listExperiments(team.db, dfy.businessId)).map((e) => e.id)).toEqual([id]);
    expect(await getExperimentData(team.db, id)).not.toBeNull();
    expect(await endExperiment(team.db, id)).toBe(true);
    expect(await deleteExperiment(team.db, id)).toBe(true);
  });

  it("a dfy_client never sees, creates, ends or deletes experiments", async () => {
    const id = await createExperiment(team.db, { businessId: dfy.businessId, test: [dfyQ[0]], name: "Menu" });
    expect(await listExperiments(client.db, dfy.businessId)).toEqual([]);
    expect(must(await client.db.from("experiment_questions").select("question_id").eq("experiment_id", id))).toEqual(
      [],
    );
    expect(await getExperimentData(client.db, id)).toBeNull();
    await expect(createExperiment(client.db, { businessId: dfy.businessId, test: [dfyQ[0]] })).rejects.toMatchObject({
      code: "42501",
    });
    const direct = await client.db.from("experiments").insert({ business_id: dfy.businessId, name: "x" });
    expect(direct.error?.code).toBe("42501");
    expect(await endExperiment(client.db, id)).toBe(false);
    expect(await deleteExperiment(client.db, id)).toBe(false);
    expect(must(await serviceClient().from("experiments").select("status").eq("id", id))).toEqual([
      { status: "running" },
    ]);
  });

  it("an outsider, and the team on a self-serve business, are refused", async () => {
    for (const db of [outsider.db, team.db]) {
      await expect(createExperiment(db, { businessId: f.businessId, test: [q1] })).rejects.toMatchObject({
        code: "42501",
      });
    }
    const id = await createExperiment(owner.db, { businessId: f.businessId, test: [q1] });
    for (const db of [outsider.db, team.db]) {
      expect(await listExperiments(db, f.businessId)).toEqual([]);
      expect(await getExperimentData(db, id)).toBeNull();
      expect(await endExperiment(db, id)).toBe(false);
      expect(await deleteExperiment(db, id)).toBe(false);
    }
  });

  it("nobody updates experiments or experiment_questions directly", async () => {
    const id = await createExperiment(owner.db, { businessId: f.businessId, test: [q1] });
    const e = await owner.db.from("experiments").update({ status: "running", change_date: d }).eq("id", id);
    expect(e.error?.code).toBe("42501");
    const g = await owner.db.from("experiment_questions").update({ grp: "test" }).eq("experiment_id", id);
    expect(g.error?.code).toBe("42501");
    const del = await owner.db.from("experiment_questions").delete().eq("experiment_id", id);
    expect(del.error?.code).toBe("42501");
  });
});

describe("create_experiment input and defaults", () => {
  it("control defaults to the other active questions; date to LA today; name to the fix title", async () => {
    const id = await createExperiment(owner.db, { businessId: f.businessId, test: [q1], fixId: f.fixId });
    const groups = must(
      await serviceClient().from("experiment_questions").select("question_id, grp").eq("experiment_id", id),
    );
    expect(groups.filter((g) => g.grp === "test").map((g) => g.question_id)).toEqual([q1]);
    const control = groups.filter((g) => g.grp === "control").map((g) => g.question_id);
    expect(control.sort()).toEqual([f.questionId, q2, q3, q4].sort());
    expect(control).not.toContain(inactive);
    const row = must(
      await serviceClient().from("experiments").select("name, change_date, fix_id, status").eq("id", id).single(),
    );
    expect(row).toEqual({ name: "Fix profile", change_date: laToday(), fix_id: f.fixId, status: "running" });
  });

  it("keeps a picked control subset, the note and an https link", async () => {
    const id = await createExperiment(owner.db, {
      businessId: f.businessId,
      test: [q1],
      control: [q2],
      name: "  Menu page  ",
      changeNote: "Added hours",
      changeUrl: "https://example-ramen.test/menu",
      changeDate: d,
    });
    const groups = must(
      await serviceClient().from("experiment_questions").select("question_id, grp").eq("experiment_id", id),
    );
    expect(groups.filter((g) => g.grp === "control").map((g) => g.question_id)).toEqual([q2]);
    const row = must(
      await serviceClient()
        .from("experiments")
        .select("name, change_note, change_url, change_date")
        .eq("id", id)
        .single(),
    );
    expect(row).toEqual({
      name: "Menu page",
      change_note: "Added hours",
      change_url: "https://example-ramen.test/menu",
      change_date: d,
    });
  });

  // Thunks, because the fixture ids exist only after beforeAll.
  const bad: [string, () => Partial<Parameters<typeof createExperiment>[1]>][] = [
    ["no test questions", () => ({ test: [] })],
    ["an empty control group", () => ({ control: [] })],
    ["a question in both groups", () => ({ control: [q1] })],
    ["a test question from another business", () => ({ test: [other.questionId] })],
    ["a control question from another business", () => ({ control: [other.questionId] })],
    ["a future change date", () => ({ changeDate: addDays(laToday(), 1) })],
    ["a non-http link", () => ({ changeUrl: "javascript:alert(1)" })],
    ["a fix from another business", () => ({ fixId: other.fixId })],
    ["a blank name with no fix", () => ({ name: "   " })],
  ];
  for (const [label, patch] of bad) {
    it(`refuses ${label} (22023)`, async () => {
      const input = { businessId: f.businessId, test: [q1], name: "x", ...patch() };
      await expect(createExperiment(owner.db, input)).rejects.toMatchObject({ code: "22023" });
    });
  }

  it("refuses when there is no other active question for the default control (22023)", async () => {
    await expect(
      createExperiment(team.db, { businessId: dfy.businessId, test: dfyQ, name: "x" }),
    ).rejects.toMatchObject({ code: "22023" });
  });
});

describe("deletes the group rules never block", () => {
  it("a plain business and question with no experiments delete", async () => {
    const s = serviceClient();
    const b = must(
      await s.from("businesses").insert({ workspace_id: f.workspaceId, name: "Example Plain" }).select("id").single(),
    );
    const q = await question(b.id, "plain question");
    must(await s.from("questions").delete().eq("id", q));
    must(await s.from("businesses").delete().eq("id", b.id));
    expect(must(await s.from("businesses").select("id").eq("id", b.id))).toEqual([]);
  });

  it("a business with experiments deletes, and its experiments go with it", async () => {
    const s = serviceClient();
    const x = await makeWorkspace(owner);
    must(await s.from("businesses").delete().eq("id", x.businessId));
    expect(must(await s.from("experiments").select("id").eq("id", x.experimentId))).toEqual([]);
  });
});

describe("group rules on direct writes", () => {
  it("an experiment without both groups is refused at commit (23514)", async () => {
    const { error } = await owner.db.from("experiments").insert({ business_id: f.businessId, name: "x" });
    expect(error?.code).toBe("23514");
  });

  it("a question from another business can't join an experiment (23514)", async () => {
    const id = await createExperiment(owner.db, { businessId: f.businessId, test: [q1] });
    const { error } = await owner.db
      .from("experiment_questions")
      .insert({ experiment_id: id, question_id: other.questionId, grp: "control" });
    expect(error?.code).toBe("23514");
  });
});

describe("experiment_data windows", () => {
  it("counts ok answers of audit/weekly runs in [d-28, d) and [d, d+28)", async () => {
    const id = await createExperiment(owner.db, { businessId: f.businessId, test: [q1], control: [q2], changeDate: d });
    expect(await getExperimentData(owner.db, id)).toEqual({
      before: { start: addDays(d, -28), end: d },
      after: { start: d, end: addDays(d, 28) },
      test: { before: { named: 2, n: 4 }, after: { named: 4, n: 8 } },
      control: { before: { named: 0, n: 2 }, after: { named: 0, n: 4 } },
    });
  });

  it("puts a run one minute before LA midnight on d in before, and midnight in after", async () => {
    const id = await createExperiment(owner.db, { businessId: f.businessId, test: [q4], control: [q2], changeDate: d });
    expect((await getExperimentData(owner.db, id))?.test).toEqual({
      before: { named: 1, n: 1 },
      after: { named: 0, n: 1 },
    });
  });

  it("an ended test's after window stops at the end day (included)", async () => {
    const id = await createExperiment(owner.db, { businessId: f.businessId, test: [q1], control: [q2], changeDate: d });
    must(
      await serviceClient()
        .from("experiments")
        .update({ status: "ended", ended_at: `${addDays(d, 5)}T22:00:00-08:00` })
        .eq("id", id),
    );
    expect(await getExperimentData(owner.db, id)).toMatchObject({
      after: { start: d, end: addDays(d, 6) },
      test: { before: { named: 2, n: 4 }, after: { named: 2, n: 4 } },
      control: { before: { named: 0, n: 2 }, after: { named: 0, n: 2 } },
    });
  });

  it("status is done once LA today is 28 days after the change date", async () => {
    const id = await createExperiment(owner.db, { businessId: f.businessId, test: [q1], changeDate: d });
    expect((await listExperiments(owner.db, f.businessId)).find((e) => e.id === id)?.status).toBe("done");
    const recent = await createExperiment(owner.db, {
      businessId: f.businessId,
      test: [q1],
      changeDate: addDays(laToday(), -27),
    });
    expect((await listExperiments(owner.db, f.businessId)).find((e) => e.id === recent)?.status).toBe("running");
  });

  it("a deleted question drops out of its group and the counts", async () => {
    const id = await createExperiment(owner.db, {
      businessId: f.businessId,
      test: [q1, q3],
      control: [q2],
      changeDate: d,
    });
    expect((await getExperimentData(owner.db, id))?.test.before).toEqual({ named: 3, n: 5 });
    must(await serviceClient().from("questions").delete().eq("id", q3));
    expect((await getExperimentData(owner.db, id))?.test.before).toEqual({ named: 2, n: 4 });
    expect((await listExperiments(owner.db, f.businessId)).find((e) => e.id === id)?.test).toBe(1);
  });
});
