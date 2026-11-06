import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { listConnectionChangeActors, recordConnectionChange, saveConnection } from "@/lib/queries/connections";
import { createDfyClient } from "@/lib/queries/onboarding";
import { must, newUser, serviceClient, type TestUser } from "./helpers";

// 0039: connection_change_actors(business) → { change_id, actor_is_team } for the change log, gated
// like connection_changes_read. Only the team flag: no names, no emails.
const s = () => serviceClient();

let team: TestUser;
let client: TestUser;
let outsider: TestUser;
let businessId: string;
let ids: { team: string; client: string; removed: string };

beforeAll(async () => {
  team = await newUser("cca-team");
  client = await newUser("cca-client");
  outsider = await newUser("cca-outsider");
  const creator = await newUser("cca-creator");
  must(
    await s()
      .from("user_roles")
      .insert([
        { user_id: team.id, role: "team" },
        { user_id: creator.id, role: "team" },
        { user_id: client.id, role: "dfy_client" },
      ]),
  );
  const dfy = await createDfyClient(creator.db, {
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
  businessId = dfy.businessId;
  must(
    await s().from("workspace_members").insert({ workspace_id: dfy.workspaceId, user_id: client.id, role: "member" }),
  );
  const conn = await saveConnection(s(), {
    businessId,
    provider: "gbp",
    externalAccountId: "google-sub-cca",
    scopes: [],
    connectedBy: client.id,
    encAccess: "enc:v1:a",
    encRefresh: "enc:v1:r",
    expiresAt: null,
  });
  const change = (actor: string) =>
    recordConnectionChange(s(), {
      connectionId: conn,
      actor,
      field: "description",
      before: null,
      after: { text: "x" },
    });
  ids = { team: await change(team.id), client: await change(client.id), removed: await change(randomUUID()) };
});

describe("connection_change_actors", () => {
  it("flags team actors only; a client or a removed user is not the team", async () => {
    const rows = await listConnectionChangeActors(team.db, businessId);
    const flag = Object.fromEntries(rows.map((r) => [r.change_id, r.actor_is_team]));
    expect(flag).toEqual({ [ids.team]: true, [ids.client]: false, [ids.removed]: false });
    expect(Object.keys(rows[0]).sort()).toEqual(["actor_is_team", "change_id"]);
  });

  it("follows connection_changes_read: the business's client reads it too, an outsider gets nothing", async () => {
    const forClient = await listConnectionChangeActors(client.db, businessId);
    expect(forClient.map((r) => r.change_id).sort()).toEqual(Object.values(ids).sort());
    const visible = must(await client.db.from("connection_changes").select("id").eq("business_id", businessId));
    expect(visible).toHaveLength(3);

    expect(await listConnectionChangeActors(outsider.db, businessId)).toEqual([]);
    expect(must(await outsider.db.from("connection_changes").select("id").eq("business_id", businessId))).toEqual([]);
  });
});
