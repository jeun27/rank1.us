import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// C-c PR 3 (D4) on Example data (/dev/team): G7's lists at the top of the client's Sources document, decided
// by the team; View opens the team's Fixes document.
const NOW = new Date("2026-11-05T12:00:00Z");
const TITLE = "Lists that name your rivals but not you";
const axeClean = async (page: Page) => {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
};
const openSources = async (page: Page) => {
  await page.clock.setFixedTime(NOW);
  await page.goto("/dev/team");
  const mobile = page.viewportSize()!.width < 768;
  if (mobile) await page.getByRole("tab", { name: "Nav", exact: true }).click();
  await page.locator("#ws-nav").getByRole("button", { name: "Sources", exact: true }).first().click();
  if (mobile) await page.getByRole("tab", { name: "Document", exact: true }).click();
  return page.getByRole("tabpanel");
};

for (const theme of ["dark", "light"] as const)
  test(`Sources ${theme}: the lists first, Add to fixes, axe clean`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: theme });
    const doc = await openSources(page);
    const section = doc.getByRole("region", { name: TITLE });
    await expect(section.getByRole("heading", { level: 3, name: TITLE })).toBeVisible();
    const first = section.locator('[data-url="https://lists.example.test/best-ramen-irvine"]');
    await expect(first).toContainText("The 12 best ramen shops in Irvine");
    await axeClean(page);
    // The document pane scrolls inside the page, so a phone shot of the whole section needs a taller viewport.
    if (page.viewportSize()!.width < 768) await page.setViewportSize({ width: 375, height: 1400 });
    await section.screenshot({ path: `test-results/screenshots/team-mentions-${theme}-${info.project.name}.png` });
    await first.getByRole("button", { name: "Add to fixes" }).click();
    await expect(section.getByRole("list", { name: "Added" })).toContainText("The 12 best ramen shops in Irvine");
  });

test("View opens the team's Fixes document", async ({ page }) => {
  const doc = await openSources(page);
  await doc.getByRole("list", { name: "Added" }).getByRole("button", { name: "View" }).click();
  await expect(page.locator("header").getByText("What to fix next")).toBeVisible();
});
