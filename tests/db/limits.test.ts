import { beforeAll, describe, expect, it } from "vitest";
import { makeWorkspace, must, newUser, serviceClient, type Fixture, type TestUser } from "./helpers";

let a: TestUser;
let fa: Fixture;

beforeAll(async () => {
  a = await newUser("limits");
  fa = await makeWorkspace(a); // seats_quantity 1, one active business, one active question
});

const question = (businessId: string, active = true) => ({
  business_id: businessId,
  short_text: `q ${crypto.randomUUID()}`,
  location_level: "city",
  active,
});

describe("at most 25 active questions per business", () => {
  it("allows 25 active questions and blocks the 26th", async () => {
    must(await a.db.from("questions").insert(Array.from({ length: 24 }, () => question(fa.businessId))));
    const { error } = await a.db.from("questions").insert(question(fa.businessId));
    expect(error?.message).toMatch(/at most 25 active questions/);
  });

  it("allows inactive questions but blocks activating one", async () => {
    const q = must(await a.db.from("questions").insert(question(fa.businessId, false)).select().single());
    const { error } = await a.db.from("questions").update({ active: true }).eq("id", q.id);
    expect(error?.message).toMatch(/at most 25 active questions/);
  });

  it("blocks the service role too", async () => {
    const { error } = await serviceClient().from("questions").insert(question(fa.businessId));
    expect(error?.message).toMatch(/at most 25 active questions/);
  });

  it("frees a slot when a question is deactivated", async () => {
    must(await a.db.from("questions").update({ active: false }).eq("id", fa.questionId));
    must(await a.db.from("questions").insert(question(fa.businessId)));
  });
});

describe("active businesses limited to seats_quantity", () => {
  it("blocks a member insert when seats are full", async () => {
    const { error } = await a.db.from("businesses").insert({ workspace_id: fa.workspaceId, name: "Example Two" });
    expect(error?.message).toMatch(/no free seat/);
  });

  it("blocks the service role when seats are full, and allows it after seats_quantity is raised", async () => {
    const s = serviceClient();
    const blocked = await s.from("businesses").insert({ workspace_id: fa.workspaceId, name: "Example Two" });
    expect(blocked.error?.message).toMatch(/no free seat/);

    must(await s.from("workspaces").update({ seats_quantity: 2 }).eq("id", fa.workspaceId));
    must(await s.from("businesses").insert({ workspace_id: fa.workspaceId, name: "Example Two" }));
  });

  it("archived businesses free a seat, and un-archiving is blocked when seats are full", async () => {
    must(await a.db.from("businesses").update({ archived_at: new Date().toISOString() }).eq("id", fa.businessId));
    must(await a.db.from("businesses").insert({ workspace_id: fa.workspaceId, name: "Example Three" }));
    const { error } = await a.db.from("businesses").update({ archived_at: null }).eq("id", fa.businessId);
    expect(error?.message).toMatch(/no free seat/);
  });

  // Lead decision (Step 5): an unpaid workspace (seats 0) may hold exactly one active business.
  it("a new workspace (seats 0) can add one business before checkout, not a second", async () => {
    const ws = must(await a.db.from("workspaces").insert({ name: "Example New", owner_id: a.id }).select().single());
    must(await a.db.from("businesses").insert({ workspace_id: ws.id, name: "Example Four" }));
    const { error } = await a.db.from("businesses").insert({ workspace_id: ws.id, name: "Example Five" });
    expect(error?.message).toMatch(/no free seat/);
  });
});
