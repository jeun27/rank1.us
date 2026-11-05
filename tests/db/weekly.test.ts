import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureSelfServeWorkspace } from "@/lib/queries/auth";
import { createBusinessOnboarding, createDfyClient } from "@/lib/queries/onboarding";
import { enqueueWeeklyRuns, laWeekStart, pruneEphemeral } from "@/lib/queries/weekly";
import { anonClient, must, newUser, serviceClient } from "./helpers";

const loose = (db: unknown) => db as SupabaseClient;
const week = () => laWeekStart(new Date());
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600 * 1000).toISOString();

const question = {
  short_text: "best pho in Irvine",
  long_text: "Where is great pho in Irvine?",
  active_form: "short" as const,
  active: true,
  location_level: "city" as const,
  country: "US",
  state: "CA",
  city: "Irvine",
  template_key: "1",
};

// A self-serve business with one active question (or none) and the given subscription status.
async function selfServe(tag: string, status: string | null, questions = 1) {
  const user = await newUser(tag);
  const workspaceId = (await ensureSelfServeWorkspace(user.db))!;
  const businessId = await createBusinessOnboarding(user.db, {
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
    questions: Array.from({ length: questions }, () => question),
  });
  must(await serviceClient().from("workspaces").update({ subscription_status: status }).eq("id", workspaceId));
  return { user, businessId };
}

async function dfyBusiness(tag: string) {
  const team = await newUser(tag);
  must(await serviceClient().from("user_roles").insert({ user_id: team.id, role: "team" }));
  const { businessId } = await createDfyClient(team.db, {
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
      .from("questions")
      .insert({ business_id: businessId, ...question }),
  );
  return businessId;
}

const weeklyRuns = async (businessId: string) =>
  must(
    await serviceClient()
      .from("runs")
      .select("id, status, started_at")
      .eq("business_id", businessId)
      .eq("kind", "weekly"),
  );

const closeRuns = async (businessId: string) =>
  must(
    await serviceClient()
      .from("runs")
      .update({ status: "complete" })
      .eq("business_id", businessId)
      .in("status", ["queued", "running"]),
  );

describe("enqueue_weekly_runs", () => {
  it("enqueues paid, trialing and DFY businesses; never unpaid, past_due, archived or question-less ones", async () => {
    const paid = await selfServe("weekly-paid", "active");
    const trial = await selfServe("weekly-trial", "trialing");
    const dfy = await dfyBusiness("weekly-dfy-team");
    const unpaid = await selfServe("weekly-unpaid", null);
    const pastDue = await selfServe("weekly-past-due", "past_due");
    const archived = await selfServe("weekly-archived", "active");
    must(
      await serviceClient()
        .from("businesses")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", archived.businessId),
    );
    const empty = await selfServe("weekly-empty", "active", 0);

    const result = await enqueueWeeklyRuns(serviceClient(), week());
    expect(result.enqueued).toBeGreaterThanOrEqual(3);
    expect(Object.keys(result).sort()).toEqual(["enqueued", "failed", "skipped"]);

    for (const id of [paid.businessId, trial.businessId, dfy]) {
      const runs = await weeklyRuns(id);
      expect(runs, id).toHaveLength(1);
      expect(must(await serviceClient().from("run_jobs").select("id").eq("run_id", runs[0].id))).toHaveLength(10);
    }
    for (const id of [unpaid.businessId, pastDue.businessId, archived.businessId, empty.businessId]) {
      expect(await weeklyRuns(id), id).toEqual([]);
    }
  });

  it("is idempotent within the week: a second call adds nothing, even after the first run finished", async () => {
    const paid = await selfServe("weekly-twice", "active");
    await enqueueWeeklyRuns(serviceClient(), week());
    await enqueueWeeklyRuns(serviceClient(), week());
    expect(await weeklyRuns(paid.businessId)).toHaveLength(1);

    await closeRuns(paid.businessId);
    await enqueueWeeklyRuns(serviceClient(), week());
    expect(await weeklyRuns(paid.businessId)).toHaveLength(1);
  });

  it("a weekly run from an earlier week doesn't block this week's", async () => {
    const paid = await selfServe("weekly-last-week", "active");
    must(
      await serviceClient()
        .from("runs")
        .insert({
          business_id: paid.businessId,
          kind: "weekly",
          status: "complete",
          started_at: hoursAgo(8 * 24),
          finished_at: hoursAgo(8 * 24 - 1),
        }),
    );
    await enqueueWeeklyRuns(serviceClient(), week());
    expect(await weeklyRuns(paid.businessId)).toHaveLength(2);
  });

  it("skips a business with an open run (e.g. an audit still running)", async () => {
    const paid = await selfServe("weekly-open", "active");
    must(
      await serviceClient()
        .from("runs")
        .insert({ business_id: paid.businessId, kind: "audit", status: "running", started_at: hoursAgo(1) }),
    );
    await enqueueWeeklyRuns(serviceClient(), week());
    expect(await weeklyRuns(paid.businessId)).toEqual([]);
  });

  it("two concurrent calls for the same week make exactly one run per business", async () => {
    const a = await selfServe("weekly-race-a", "active");
    const b = await selfServe("weekly-race-b", "trialing");
    const [first, second] = await Promise.all([
      enqueueWeeklyRuns(serviceClient(), week()),
      enqueueWeeklyRuns(serviceClient(), week()),
    ]);
    expect(first.failed + second.failed).toBe(0);
    for (const id of [a.businessId, b.businessId]) expect(await weeklyRuns(id), id).toHaveLength(1);
  });

  it("rejects a week start that isn't the current LA week's Monday (22023)", async () => {
    const monday = week();
    const tuesday = new Date(`${monday}T12:00:00Z`);
    tuesday.setUTCDate(tuesday.getUTCDate() + 1);
    const lastMonday = new Date(`${monday}T12:00:00Z`);
    lastMonday.setUTCDate(lastMonday.getUTCDate() - 7);
    for (const bad of [tuesday.toISOString().slice(0, 10), lastMonday.toISOString().slice(0, 10)]) {
      await expect(enqueueWeeklyRuns(serviceClient(), bad)).rejects.toMatchObject({ code: "22023" });
    }
  });
});

describe("prune_ephemeral", () => {
  it("deletes lookup_cache rows over 24 h and rate_events over 48 h, keeping newer ones", async () => {
    const user = await newUser("prune");
    const s = serviceClient();
    must(
      await s.from("lookup_cache").insert([
        { user_id: user.id, kind: "read_site", key: "kept", result: { ok: true }, created_at: hoursAgo(23) },
        { user_id: user.id, kind: "read_site", key: "old", result: { ok: true }, created_at: hoursAgo(25) },
      ]),
    );
    must(
      await s.from("rate_events").insert([
        { user_id: user.id, kind: "maps_lookup", created_at: hoursAgo(47) },
        { user_id: user.id, kind: "maps_lookup", created_at: hoursAgo(49) },
      ]),
    );

    const result = await pruneEphemeral(s);
    expect(result.lookup_cache).toBeGreaterThanOrEqual(1);
    expect(result.rate_events).toBeGreaterThanOrEqual(1);
    expect(Object.keys(result).sort()).toEqual(["lookup_cache", "rate_events"]);
    expect(must(await s.from("lookup_cache").select("key").eq("user_id", user.id))).toEqual([{ key: "kept" }]);
    const rates = must(await s.from("rate_events").select("created_at").eq("user_id", user.id));
    expect(rates).toHaveLength(1);
    expect(Date.now() - new Date(rates[0].created_at).getTime()).toBeLessThan(48 * 3600 * 1000);
  });
});

describe("service role only", () => {
  it("members and anon get 42501 on both functions", async () => {
    const member = await selfServe("weekly-caller", "active");
    for (const db of [member.user.db, anonClient()]) {
      expect((await loose(db).rpc("enqueue_weekly_runs", { p_week_start: week() })).error?.code).toBe("42501");
      expect((await loose(db).rpc("prune_ephemeral")).error?.code).toBe("42501");
    }
  });
});
