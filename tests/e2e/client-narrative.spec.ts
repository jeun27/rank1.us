import { test, expect } from "@playwright/test";
import { expectAxeClean, expectNoSideScroll } from "./helpers/forms";

// Q4 (lead 2026-11-06) on Example data (/dev/client?state=narrative): the read-only clash card under the
// connect slot, before Visibility. No edit link: the team sets the client's words in /team.
const TITLE = "How AI describes you";

for (const theme of ["dark", "light"] as const)
  test(`/dev/client narrative (${theme}): the clash card, read-only, before Visibility; axe clean`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/dev/client?state=narrative");
    const card = page.getByRole("region", { name: TITLE });
    await expect(card).toContainText("6 of 48 answers use words you want to avoid: cheap");
    await expect(card.locator("mark")).toHaveText("cheap");
    await expect(card.getByRole("link")).toHaveCount(0);
    const below = await page
      .getByRole("heading", { name: "Visibility" })
      .evaluate(
        (h, el) => Boolean(el!.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING),
        await card.elementHandle(),
      );
    expect(below).toBe(true);
    await expectNoSideScroll(page);
    await expectAxeClean(page);
    await card.screenshot({ path: `test-results/screenshots/client-narrative-${theme}-${info.project.name}.png` });
  });

test("no clash: no card", async ({ page }) => {
  await page.goto("/dev/client?state=narrative-no-clash");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
  await expect(page.getByRole("region", { name: TITLE })).toHaveCount(0);
});
