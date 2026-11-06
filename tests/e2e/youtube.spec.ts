import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// G1 on Example data (#150 review): each YouTube fix shows only its own failing videos, from the stored
// evidence (R19 title, R20 description, R21 chapters); the captions line sits under R19 only. The live
// YouTube tile shows its status and the shared-grant Disconnect.
const axeClean = async (page: Page) => {
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
};
const row = (page: Page, title: string) => page.getByRole("checkbox", { name: title }).locator("xpath=ancestor::li[1]");

for (const theme of ["dark", "light"] as const)
  test(`What to fix next ${theme}: R19 shows its own videos and the captions line; Suggest fix copies; axe clean`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/dev/app?state=fixes-youtube");
    const r19 = row(page, "Put your keyword in your video titles");
    await expect(r19).toContainText("Keyword: ramen");
    await expect(r19.locator("[data-video]")).toHaveCount(1);
    await expect(r19).toContainText("Says the keyword: Can't check");
    await axeClean(page);
    await r19.screenshot({ path: `test-results/screenshots/youtube-fix-${theme}-${info.project.name}.png` });
    await r19.getByRole("button", { name: "Suggest fix" }).click();
    await expect(r19).toContainText("ramen | A night at the counter");
    await expect(r19.getByRole("button", { name: "Apply in YouTube" })).toBeDisabled();
    await axeClean(page);
  });

test("R20 and R21 each list only their own videos, with no captions line", async ({ page }) => {
  await page.goto("/dev/app?state=fixes-youtube");
  for (const title of [
    "Put your keyword in the first two lines of the description",
    "Add chapters on videos 5 minutes or longer",
  ]) {
    const r = row(page, title);
    await r.getByRole("button", { name: title }).click();
    await expect(r).not.toContainText("Says the keyword");
  }
  await expect(row(page, "Add chapters on videos 5 minutes or longer").locator("[data-video]")).toHaveCount(1);
});

for (const theme of ["dark", "light"] as const)
  test(`Connections ${theme}: the YouTube tile is live, Connected, the shared-grant Disconnect`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/dev/app?state=connections-youtube");
    const t = page.getByRole("article", { name: "YouTube" });
    await expect(t.getByTestId("status")).toHaveText("Connected");
    await axeClean(page);
    await t.screenshot({ path: `test-results/screenshots/youtube-tile-${theme}-${info.project.name}.png` });
    await t.getByRole("button", { name: "Disconnect" }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "This disconnects every Google service Rank1 uses: Business Profile, Search Console, Analytics and YouTube.",
    );
  });
