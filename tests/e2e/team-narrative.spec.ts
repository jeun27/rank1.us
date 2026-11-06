import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// C-c PR 3 (D3, lead Q6 O1) on Example data (/dev/team): "How AI describes {Business}" opens from the client
// switcher beside Connections; the editor keeps the client's own labels; Save goes through the team action.
const NOW = new Date("2026-11-05T12:00:00Z");
const TITLE = "How AI describes Example Ramen House";
const axeClean = async (page: Page) => {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
};

for (const theme of ["dark", "light"] as const)
  test(`${TITLE} ${theme}: from the switcher, the client's labels, Save; axe clean`, async ({ page }, info) => {
    await page.clock.setFixedTime(NOW);
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/dev/team");
    await page.getByRole("button", { name: /^Client / }).click();
    await page.getByRole("button", { name: TITLE }).click();
    if (page.viewportSize()!.width < 768) await page.getByRole("tab", { name: "Document", exact: true }).click();
    const doc = page.getByRole("tabpanel");
    await expect(doc.getByRole("heading", { level: 2, name: TITLE })).toBeVisible();
    await expect(page.getByRole("tablist", { name: "Document" }).getByRole("tab", { selected: true })).toHaveText(
      TITLE,
    );
    await expect(doc.getByRole("group", { name: "Words that fit you" })).toContainText("in 20 of 48 answers");
    await expect(doc.getByRole("group", { name: "Words to avoid" })).toBeVisible();
    await axeClean(page);
    if (page.viewportSize()!.width < 768) await page.setViewportSize({ width: 375, height: 1400 });
    await doc.screenshot({ path: `test-results/screenshots/team-narrative-${theme}-${info.project.name}.png` });
    await doc.getByRole("button", { name: "Save" }).click();
    await expect(doc.getByRole("status")).toHaveText("Saved.");
  });
