import { test, expect } from "@playwright/test";

// QA N1: after a keyboard check-off, Undo or Start, focus lands on a sensible next target, never on body.
const focused = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el && el !== document.body
      ? `${el.getAttribute("role") ?? el.tagName}:${el.getAttribute("aria-label") ?? el.textContent?.trim()}`
      : "body";
  });

test.beforeEach(async ({ page }) => {
  await page.goto("/dev/app?state=fixes-success");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("x on a fix moves focus to the next fix's check-off", async ({ page }) => {
  const boxes = page.getByRole("checkbox");
  const [first, second] = [
    await boxes.nth(0).getAttribute("aria-label"),
    await boxes.nth(1).getAttribute("aria-label"),
  ];
  await boxes.nth(0).focus();
  await page.keyboard.press("x");
  await expect(page.getByRole("status")).toContainText(first!);
  await expect(page.getByRole("checkbox", { name: second! })).toBeFocused();
});

test("Undo in the toast puts focus back on the restored fix's check-off", async ({ page }) => {
  const box = page.getByRole("checkbox").first();
  const name = (await box.getAttribute("aria-label"))!;
  await box.click();
  await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("checkbox", { name })).toBeFocused();
  expect(await focused(page)).not.toBe("body");
});

test("s on a fix keeps focus on that fix", async ({ page }) => {
  const box = page.getByRole("checkbox").first();
  const name = (await box.getAttribute("aria-label"))!;
  await box.focus();
  await page.keyboard.press("s");
  await expect(page.getByRole("checkbox", { name })).toHaveAttribute("aria-checked", "mixed");
  expect(await focused(page)).not.toBe("body");
  await expect(page.getByRole("checkbox", { name })).toBeFocused();
});
