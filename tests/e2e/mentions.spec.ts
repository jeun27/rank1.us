import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// G7 "Lists that name your rivals but not you" on Example data (lead OK 2026-11-06): the section at the top
// of /app/sources, optimistic decisions, the empty states, and the R17 fix's evidence.
const axeClean = async (page: Page) => {
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
};
const section = (page: Page) => page.getByRole("region", { name: "Lists that name your rivals but not you" });

for (const theme of ["dark", "light"] as const)
  test(`Sources ${theme}: the section first, Add to fixes and Not relevant move rows; axe clean`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/dev/app?state=sources-mentions");
    const s = section(page);
    await expect(s.getByText("Pages AI cites that name competitors but not you")).toBeVisible();
    const first = s.locator('[data-url="https://lists.example.test/best-ramen-irvine"]');
    await expect(first).toContainText("Names Example Noodle Bar, Example Izakaya, Example Udon Spot +1");
    await expect(first).toContainText("In 18 of 240 answers · ChatGPT, Perplexity");
    await expect(first.getByRole("link", { name: "The 12 best ramen shops in Irvine" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    await axeClean(page);
    await s.screenshot({ path: `test-results/screenshots/mentions-sources-${theme}-${info.project.name}.png` });

    await first.getByRole("button", { name: "Add to fixes" }).click();
    await expect(s.getByRole("list", { name: "Added" }).getByText("The 12 best ramen shops in Irvine")).toBeVisible();
    await expect(first.getByRole("link", { name: "View" })).toHaveAttribute("href", "/app/fixes#fix-example-r17");
    const late = s.locator('[data-url="https://lists.example.test/late-night-diamond-jamboree"]');
    await late.getByRole("button", { name: "Not relevant" }).click();
    await expect(s.getByText("Not relevant (2)")).toBeVisible();
    await expect(late).toBeHidden();
    await axeClean(page);
  });

test("read-only: the lists, no actions", async ({ page }) => {
  await page.goto("/dev/app?state=sources-mentions-readonly");
  await expect(section(page).getByRole("link", { name: "The 12 best ramen shops in Irvine" })).toBeVisible();
  await expect(section(page).getByRole("button")).toHaveCount(0);
});

test("empty: before the first run, and a run with no lists", async ({ page }) => {
  await page.goto("/dev/app?state=sources-mentions-first");
  await expect(section(page)).toContainText("No lists like this yet. They show after your first run.");
  await page.goto("/dev/app?state=sources-mentions-none");
  await expect(section(page)).toContainText("None in your last run. We check again on every run.");
  await axeClean(page);
});

for (const theme of ["dark", "light"] as const)
  test(`What to fix next ${theme}: the R17 fix shows 3 added lists, then +n more`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/dev/app?state=fixes-mentions");
    const r17 = page.getByRole("checkbox", { name: "Get on these lists" }).locator("xpath=ancestor::li[1]");
    await expect(r17.getByRole("link", { name: "The OC noodle guide" })).toBeVisible();
    await expect(r17.getByRole("link", { name: "+1 more" })).toHaveAttribute("href", "/app/sources");
    await axeClean(page);
    await r17.screenshot({ path: `test-results/screenshots/mentions-fixes-${theme}-${info.project.name}.png` });
  });
