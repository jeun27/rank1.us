import { test, expect } from "@playwright/test";
import { admin, newUser, openMagicLink, workspacesOwnedBy } from "./helpers/auth";

// Step 16 on the local stack: the real /app/report settings and history download, read through RLS.
test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");

const must = <T>(r: { data: T; error: unknown }): NonNullable<T> => {
  if (r.error) throw r.error;
  return r.data as NonNullable<T>;
};

test("owner saves recipients and a color, they persist; a history download redirects to a signed URL", async ({
  page,
}) => {
  const owner = await newUser("report-owner");
  await openMagicLink(page, owner.email);
  const [{ workspace_id }] = await workspacesOwnedBy(owner.id);
  const biz = must(
    await admin().from("businesses").insert({ workspace_id, name: "Example Ramen House" }).select("id").single(),
  );
  const path = `${biz.id}/2026-10.pdf`;
  must(
    await admin()
      .storage.from("reports")
      .upload(path, new TextEncoder().encode("%PDF-1.4\n%Example\n"), { contentType: "application/pdf" }),
  );
  const report = must(
    await admin()
      .from("reports")
      .insert({
        business_id: biz.id,
        period_start: "2026-10-01",
        period_end: "2026-10-31",
        status: "generated",
        pdf_path: path,
      })
      .select("id")
      .single(),
  );

  await page.goto("/app/report");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Reports");
  await page.getByLabel("Recipients").fill("a@example.test\nb@example.test");
  await page.getByLabel("Brand color").evaluate((el: HTMLInputElement) => {
    el.value = "#0a7f3c";
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved.");
  await page.reload();
  await expect(page.getByLabel("Recipients")).toHaveValue("a@example.test\nb@example.test");
  await expect(page.getByText("#0A7F3C")).toBeVisible();

  // The preview is last month's real PDF for the current business, never cached.
  const preview = await page.request.get("/app/report/preview.pdf");
  expect(preview.status()).toBe(200);
  expect(preview.headers()["content-type"]).toBe("application/pdf");
  expect(preview.headers()["cache-control"]).toContain("no-store");
  expect((await preview.body()).subarray(0, 5).toString()).toBe("%PDF-");

  const res = await page.request.get(`/app/report/${report.id}/download`, { maxRedirects: 0 });
  expect(res.status()).toBe(302);
  expect(res.headers()["location"]).toContain("/storage/v1/object/sign/reports/");
  expect(
    (await page.request.get("/app/report/00000000-0000-0000-0000-000000000000/download", { maxRedirects: 0 })).status(),
  ).toBe(404);
});
