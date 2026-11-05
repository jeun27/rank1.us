import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { admin, newUser, openMagicLink, workspacesOwnedBy } from "./helpers/auth";

test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");

// A free audit as the audit form creates it: a lead, then create_free_audit (service role).
async function freeAudit() {
  const db = admin();
  const email = `audit-${randomUUID()}@example.test`;
  const token = `e2e-${randomUUID()}`;
  const { data: lead, error } = await db
    .from("leads")
    .insert({ email, domain: "exampleramen.test", token })
    .select("id")
    .single();
  if (error) throw error;
  const rpc = await db.rpc("create_free_audit", {
    p: {
      lead_id: lead.id,
      business: { name: "Example Ramen House", domain: "exampleramen.test" },
      location: { country: "US", state: "CA", city: "Irvine" },
      questions: [{ text: "best ramen in Irvine", location_level: "city" }],
      competitors: [{ name: "Example Noodle Bar", domain: "examplenoodle.test" }],
    },
  });
  if (rpc.error) throw rpc.error;
  return { email, token };
}

test("free audit by token: progress, no lead email on the page, never indexed or referred", async ({ page }) => {
  const { email, token } = await freeAudit();
  const res = await page.goto(`/audit/${token}`);
  expect(res?.status()).toBe(200);
  expect(res?.headers()["referrer-policy"]).toBe("no-referrer");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Your free audit");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex.*nofollow/);
  await expect(page.getByText("Checking 4 AI engines…")).toBeVisible();
  await expect(page.getByText("0 of 10 answers").first()).toBeVisible();
  await expect(page.getByText("Powered by Rank1")).toBeVisible();
  expect(await page.content()).not.toContain(email);

  const csv = await page.request.get(`/audit/${token}/export.csv`);
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-disposition"]).toMatch(/^attachment; filename="rank1-audit-exampleramen\.test\.csv"$/);
  expect(csv.headers()["cache-control"]).toBe("no-store");
  const png = await page.request.get(`/audit/${token}/export.png`);
  expect(png.status()).toBe(200);
  expect(png.headers()["content-type"]).toBe("image/png");
  expect((await page.request.get(`/audit/not-${token}/export.csv`)).status()).toBe(404);
});

test("paid run: the member sees results and downloads; anyone else gets a 404", async ({ page, browser }) => {
  const owner = await newUser("run-owner");
  await openMagicLink(page, owner.email);
  const [{ workspace_id }] = await workspacesOwnedBy(owner.id);
  const db = admin();
  const { data: biz, error } = await db
    .from("businesses")
    .insert({ workspace_id, name: "Example Ramen House", domain: "exampleramen.test", city: "Irvine", state: "CA" })
    .select("id")
    .single();
  if (error) throw error;
  const { data: q } = await db
    .from("questions")
    .insert({ business_id: biz.id, short_text: "best ramen in Irvine", location_level: "city", city: "Irvine" })
    .select("id")
    .single();
  const { data: run } = await db
    .from("runs")
    .insert({
      business_id: biz.id,
      kind: "audit",
      status: "complete",
      jobs_total: 10,
      jobs_ok: 2,
      started_at: "2026-11-05T12:00:00Z",
      finished_at: "2026-11-05T12:30:00Z",
    })
    .select("id")
    .single();
  const brands = (mentioned: boolean) => [
    { name: "Example Ramen House", kind: "business", mentioned, position: mentioned ? 1 : null },
  ];
  const ins = await db.from("answers").insert(
    [true, false].map((m, i) => ({
      run_id: run!.id,
      question_id: q!.id,
      engine: "perplexity",
      run_index: i + 1,
      status: "ok",
      question_text_used: "best ramen in Irvine",
      mentioned: m,
      brands: brands(m),
      checked_at: "2026-11-05T12:20:00Z",
    })),
  );
  if (ins.error) throw ins.error;

  await page.goto(`/app/runs/${run!.id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Audit results");
  await expect(page.getByText("named in 1 of 2 answers").first()).toBeVisible();
  await expect(page.getByText("Powered by Rank1")).toHaveCount(0);
  const csv = await page.request.get(`/app/runs/${run!.id}/export.csv`);
  expect(csv.status()).toBe(200);
  expect((await csv.text()).trimEnd().split("\r\n")).toHaveLength(3);

  const other = await browser.newPage();
  const stranger = await newUser("run-stranger");
  await openMagicLink(other, stranger.email);
  expect((await other.goto(`/app/runs/${run!.id}`))?.status()).toBe(404);
  expect((await other.request.get(`/app/runs/${run!.id}/export.csv`)).status()).toBe(404);
  await other.close();
});
