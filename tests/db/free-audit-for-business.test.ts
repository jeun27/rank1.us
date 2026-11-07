import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ensureSelfServeWorkspace } from "@/lib/queries/auth";
import { createBusinessOnboarding } from "@/lib/queries/onboarding";
import { getFreeAuditForBusiness } from "@/lib/queries/results";
import { anonClient, must, newUser, serviceClient, type TestUser } from "./helpers";

// 0042: the latest free audit that is the business's own, for the locked Dashboard headline. It counts
// only when its domain AND its lead email match the business's domain and its workspace owner (P4).
const s = () => serviceClient();
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

async function owned(tag: string, domain = `${tag}-${randomUUID().slice(0, 8)}.test`) {
  const owner = await newUser(tag);
  await ensureSelfServeWorkspace(owner.db);
  const businessId = await createBusinessOnboarding(owner.db, {
    business: {
      name: "Example Pho Spot",
      domain,
      cuisine: "pho",
      city: "Irvine",
      state: "CA",
      country: "US",
      aliases: [],
    },
    competitors: [],
    questions: [],
  });
  return { owner, businessId, domain };
}

// A free audit by `email` for `domain`: `named` of `n` ok answers (a failed answer never counts).
async function freeAudit(
  email: string,
  domain: string,
  named: number,
  n: number,
  opts = { status: "complete", at: 10 },
) {
  const run = must(
    await s()
      .from("runs")
      .insert({
        kind: "free_audit",
        status: opts.status,
        started_at: minutesAgo(opts.at + 1),
        finished_at: minutesAgo(opts.at),
      })
      .select("id")
      .single(),
  ).id;
  const lead = must(
    await s().from("leads").insert({ email, domain, run_id: run, token: randomUUID() }).select("id").single(),
  ).id;
  const brand = { name: "Example Pho Spot", domain, aliases: [] };
  must(
    await s()
      .from("free_audits")
      .insert({ run_id: run, lead_id: lead, domain, brands: { business: brand, competitors: [] }, country: "US" }),
  );
  const answers = [
    ...Array.from({ length: n }, (_, i) => ({ status: "ok", mentioned: i < named })),
    { status: "failed", mentioned: true },
  ].map((a, i) => ({
    run_id: run,
    engine: (["chatgpt", "gemini", "google_aio", "perplexity"] as const)[i % 4],
    run_index: (Math.floor(i / 4) % 3) + 1,
    question_text_used: `best pho in Irvine ${i}`,
    ...a,
  }));
  must(await s().from("answers").insert(answers));
  return run;
}

describe("free audit for a business", () => {
  it("returns the latest matching audit's numbers (domain and email compared case-insensitively)", async () => {
    const { owner, businessId, domain } = await owned("fa-own");
    await freeAudit(owner.email, domain, 2, 8, { status: "complete", at: 60 });
    const latest = await freeAudit(owner.email.toUpperCase(), domain.toUpperCase(), 9, 40, {
      status: "partial",
      at: 5,
    });
    expect(await getFreeAuditForBusiness(owner.db, businessId)).toMatchObject({ runId: latest, named: 9, n: 40 });
  });

  it("ignores another user's audit for the same domain, and the owner's audit of another domain", async () => {
    const { owner, businessId, domain } = await owned("fa-other");
    const stranger = await newUser("fa-stranger");
    await freeAudit(stranger.email, domain, 5, 10);
    await freeAudit(owner.email, `other-${randomUUID().slice(0, 8)}.test`, 5, 10);
    expect(await getFreeAuditForBusiness(owner.db, businessId)).toBeNull();
  });

  it("ignores failed or unfinished audits", async () => {
    const { owner, businessId, domain } = await owned("fa-failed");
    await freeAudit(owner.email, domain, 3, 10, { status: "failed", at: 5 });
    await freeAudit(owner.email, domain, 3, 10, { status: "running", at: 1 });
    expect(await getFreeAuditForBusiness(owner.db, businessId)).toBeNull();
  });

  it("is empty for a non-member and refused for anon", async () => {
    const { owner, businessId, domain } = await owned("fa-member");
    await freeAudit(owner.email, domain, 3, 10);
    const outsider: TestUser = await newUser("fa-outsider");
    expect(await getFreeAuditForBusiness(outsider.db, businessId)).toBeNull();
    await expect(getFreeAuditForBusiness(anonClient(), businessId)).rejects.toMatchObject({ code: "42501" });
  });
});
