import { test, expect } from "@playwright/test";
import { expectAxeClean, expectNoSideScroll } from "./helpers/forms";

const pages = [
  {
    path: "/privacy",
    h1: "Privacy",
    topics: [
      "Google user data",
      "Google account email and name",
      "business.manage",
      "webmasters.readonly",
      "analytics.readonly",
      "youtube.readonly",
      "including the Limited Use requirements",
      "delete your data through the Contact us form",
      "Supabase",
      "Stripe",
      "Resend",
      "Cloudflare Turnstile",
      "Vercel",
    ],
  },
  { path: "/terms", h1: "Terms", topics: ["$99/mo per business", "Contact us"] },
];

for (const p of pages) {
  test(`${p.path}: [LEGAL REVIEW NEEDED] at the top, date, required topics, axe clean`, async ({ page }, info) => {
    await page.goto(p.path);
    const marker = page.getByText("[LEGAL REVIEW NEEDED]", { exact: true });
    await expect(marker).toBeVisible();
    expect((await marker.boundingBox())!.y).toBeLessThan(10);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(p.h1);
    await expect(page.locator("time")).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}$/);
    await expect(page.getByText(/Last updated/)).toBeVisible();
    const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    for (const t of p.topics) expect(text).toContain(t);
    await expectNoSideScroll(page);
    await expectAxeClean(page);
    await page.screenshot({ path: `test-results/screenshots${p.path}-${info.project.name}.png`, fullPage: true });
  });
}
