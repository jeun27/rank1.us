import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// C-c PR 1 on Example data (/dev/team): the team's Connections document, opened from the client switcher, with
// the G3 notice, the connection rows and their task lines, the change log with values, and interest.
const NOW = new Date("2026-11-05T12:00:00Z");
const axeClean = async (page: Page) => {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
};

for (const theme of ["dark", "light"] as const)
  test(`Connections ${theme}: the notice, rows, tasks, log; Dismiss; axe clean`, async ({ page }, info) => {
    await page.clock.setFixedTime(NOW);
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/dev/team");
    await page.getByRole("button", { name: /^Client / }).click();
    await page.getByRole("button", { name: "Connections", exact: true }).click();
    if (page.viewportSize()!.width < 768) await page.getByRole("tab", { name: "Document", exact: true }).click();
    const doc = page.getByRole("tabpanel");
    const notice = doc.getByRole("region", { name: "Example Ramen House is ready for GAS" });
    await expect(notice).toContainText("Google Business Profile and Google Analytics connected 12 min ago.");
    await expect(doc.getByRole("listitem", { name: "Google Search Console" })).toContainText(
      "Ask the client to reconnect Google Search Console",
    );
    await expect(doc.getByRole("listitem", { name: "Google Analytics" })).toContainText(
      "Ask the client to choose their properties",
    );
    const log = doc.getByRole("list", { name: "Changes" });
    await expect(log).toContainText("https://exampleramen.test");
    // #160 S1: one entry each by the Rank1 team, a current client user, and a former user.
    await expect(log.getByRole("listitem")).toHaveCount(3);
    await expect(log.getByRole("listitem").nth(0)).toContainText("by Rank1 team");
    await expect(log.getByRole("listitem").nth(1)).toContainText("by owner@exampleramen.test");
    await expect(log.getByRole("listitem").nth(2)).toContainText("by a former user");
    await expect(doc).toContainText("Asked to hear about Yelp");
    await axeClean(page);
    await doc.screenshot({ path: `test-results/screenshots/team-connections-${theme}-${info.project.name}.png` });
    await log.screenshot({ path: `test-results/screenshots/team-connections-log-${theme}-${info.project.name}.png` });
    await notice.getByRole("button", { name: "Dismiss" }).click();
    await expect(doc.getByRole("region", { name: /ready for GAS/ })).toHaveCount(0);
  });

test("Start on the fix list opens the Fixes document", async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await page.goto("/dev/team");
  await page.getByRole("button", { name: /^Client / }).click();
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  if (page.viewportSize()!.width < 768) await page.getByRole("tab", { name: "Document", exact: true }).click();
  await page.getByRole("button", { name: "Start on the fix list" }).click();
  await expect(page.locator("header").getByText("What to fix next")).toBeVisible();
});

// C-c PR 2: Edit Business Profile, preview then apply (three fields), on Example data.
for (const theme of ["dark", "light"] as const)
  test(`Edit Business Profile ${theme}: preview shows Before/After, Apply only then; axe clean`, async ({
    page,
  }, info) => {
    await page.clock.setFixedTime(NOW);
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/dev/team");
    await page.getByRole("button", { name: /^Client / }).click();
    await page.getByRole("button", { name: "Connections", exact: true }).click();
    if (page.viewportSize()!.width < 768) await page.getByRole("tab", { name: "Document", exact: true }).click();
    const gbp = page.getByRole("tabpanel").getByRole("listitem", { name: "Google Business Profile" });
    await gbp.getByRole("button", { name: "Edit Business Profile" }).click();
    await expect(gbp.getByLabel(/hours/i)).toHaveCount(0);
    await expect(gbp.getByRole("button", { name: "Apply" })).toHaveCount(0);
    await gbp.getByLabel("Website").fill("https://exampleramen.test");
    await gbp.getByRole("button", { name: "Preview changes" }).click();
    const list = gbp.getByRole("list", { name: "Preview changes" });
    await expect(list).toContainText("After: https://exampleramen.test");
    await axeClean(page);
    await gbp.screenshot({ path: `test-results/screenshots/team-gbp-edit-${theme}-${info.project.name}.png` });
    await gbp.getByRole("button", { name: "Apply" }).click();
    await expect(gbp.getByRole("status")).toHaveText("Applied.");
  });
