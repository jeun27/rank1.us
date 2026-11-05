import { beforeAll, describe, expect, it } from "vitest";
import { buildWorkspace, getWorkspaceRows } from "@/lib/queries/workspace";
import { exampleWorkspaceRows } from "@/app/team/example-data";
import { IDS } from "../../scripts/seed/data";
import { makeWorkspace, newUser, resetDb, serviceClient } from "./helpers";

// Another file rolls migrations back and forth, so start from the committed seed.
beforeAll(resetDb);

const byId = <T extends { id: string }>(xs: T[]) => [...xs].sort((a, b) => a.id.localeCompare(b.id));

describe("getWorkspaceRows", () => {
  it("reads the seeded Example Ramen House exactly as /team's Example data shows it", async () => {
    const rows = await getWorkspaceRows(serviceClient(), IDS.business);
    const fromDb = buildWorkspace(rows!);
    const example = buildWorkspace(exampleWorkspaceRows());
    expect({ ...fromDb, questions: byId(fromDb.questions) }).toEqual({
      ...example,
      questions: byId(example.questions),
    });
  });

  it("is RLS-scoped: a member reads their business, nobody else's", async () => {
    const a = await newUser("ws-a");
    const b = await newUser("ws-b");
    const fa = await makeWorkspace(a);
    await makeWorkspace(b);
    const rows = await getWorkspaceRows(a.db, fa.businessId);
    expect(rows?.business.id).toBe(fa.businessId);
    expect(rows?.answers).toHaveLength(1);
    expect(await getWorkspaceRows(b.db, fa.businessId)).toBeNull();
    expect(await getWorkspaceRows(a.db, IDS.business)).toBeNull();
  });
});
