import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Portal (b), the check-off Fix list in the /dev/app gallery (Example data; writes do nothing here).
for (const theme of ["dark", "light"] as const)
  test(`check-off Fix list ${theme}: circle, Start, toast with Undo, the Done filter, read-only; axe clean`, async ({
    page,
  }, info) => {
    const shot = (n: string) => `test-results/screenshots/checkoff-${n}-${theme}-${info.project.name}.png`;
    const axe = async () => expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/dev/app?state=fixes-success");
    // The page streams in: wait for its H1 so axe sees the whole page.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const first = page.getByRole("checkbox").first();
    await expect(first).toHaveAttribute("aria-checked", "false");
    await expect(page.getByText("In progress").first()).toBeVisible();
    await expect(page.getByText("Rank1 team · Nov 5")).toBeVisible();
    await axe();
    await page.screenshot({ path: shot("open") });
    // x on the focused circle marks it done; the toast offers Undo.
    await first.focus();
    await page.keyboard.press("x");
    await expect(page.getByRole("status")).toContainText("done");
    await page.screenshot({ path: shot("toast") });
    await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
    await page.getByRole("radio", { name: /Done/ }).click();
    await expect(page.getByText("Done Nov 4 · Example Owner")).toBeVisible();
    await axe();
    await page.screenshot({ path: shot("done") });
    await page.goto("/dev/app?state=fixes-readonly");
    // The page streams in: wait for its H1 so axe sees the whole page.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Start" })).toHaveCount(0);
    await axe();
    await page.screenshot({ path: shot("readonly") });
  });
