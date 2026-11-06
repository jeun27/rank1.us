import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// G1 on Example data (lead OK 2026-11-06): the Search-ready checklist inside the R19 fix, its states, and the
// live YouTube tile with its shared-grant Disconnect.
const axeClean = async (page: Page) => {
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
};

for (const theme of ["dark", "light"] as const)
  test(`What to fix next ${theme}: the checklist in the R19 fix; Suggest fix copies; axe clean`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/dev/app?state=fixes-youtube");
    const panel = page.getByRole("region", { name: "Search-ready checklist" });
    await expect(panel).toContainText("Keyword: ramen · 3 videos");
    const first = panel.locator('[data-video="1"]');
    await expect(first.getByRole("listitem").filter({ hasText: "Keyword in the first two lines" })).toContainText("No");
    await expect(first.getByRole("listitem").filter({ hasText: "Says the keyword" })).toContainText("Can't check");
    await expect(panel).toContainText("YouTube doesn't share captions with read-only access.");
    await axeClean(page);
    await page
      .getByRole("checkbox", { name: "Put your keyword in your video titles" })
      .locator("xpath=ancestor::li[1]")
      .screenshot({ path: `test-results/screenshots/youtube-fix-${theme}-${info.project.name}.png` });
    await first.getByRole("button", { name: "Suggest fix" }).click();
    await expect(first).toContainText("0:00 Intro");
    await expect(first.getByRole("button", { name: "Apply in YouTube" })).toBeDisabled();
    await axeClean(page);
  });

test("no keyword: the plain line alone; reconnect state", async ({ page }) => {
  await page.goto("/dev/app?state=fixes-youtube-nokeyword");
  await expect(page.getByText("Add your main keyword to check your videos.")).toBeVisible();
  // The plain line alone (lead): no video rows of "No keyword".
  await expect(page.locator("[data-video]")).toHaveCount(0);
  await page.goto("/dev/app?state=fixes-youtube-reauth");
  await expect(page.getByRole("link", { name: "Reconnect YouTube" })).toHaveAttribute(
    "href",
    "/app/settings/connections",
  );
});

for (const theme of ["dark", "light"] as const)
  test(`Connections ${theme}: the YouTube tile is live, Connected · n videos checked, the shared-grant Disconnect`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/dev/app?state=connections-youtube");
    const t = page.getByRole("article", { name: "YouTube" });
    await expect(t).toContainText("Connected · 3 videos checked");
    await axeClean(page);
    await t.screenshot({ path: `test-results/screenshots/youtube-tile-${theme}-${info.project.name}.png` });
    await t.getByRole("button", { name: "Disconnect" }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "This disconnects every Google service Rank1 uses: Business Profile, Search Console, Analytics and YouTube.",
    );
  });
