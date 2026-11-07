import { test, expect, type Locator } from "@playwright/test";

// Founder fix (17:05): fields with a button inside have nested radii. The button sits the same inset from
// the field's edges, and the field's radius is the button's radius plus that inset, so the corners stay
// concentric (never a square button in a circle). Measured on the real CSS at both widths (row and stacked),
// in each place the field is used.
const nested = async (field: Locator) =>
  field.evaluate((f) => {
    const b = f.querySelector("button")!;
    const fs = getComputedStyle(f);
    const [fr, br, bw] = [f.getBoundingClientRect(), b.getBoundingClientRect(), parseFloat(fs.borderTopWidth)];
    const r = (n: number) => Math.round(n * 10) / 10;
    return {
      outer: parseFloat(fs.borderBottomRightRadius),
      inner: parseFloat(getComputedStyle(b).borderBottomRightRadius),
      right: r(fr.right - br.right - bw),
      bottom: r(fr.bottom - br.bottom - bw),
    };
  });

for (const [where, path, scope] of [
  ["/dev/ui DomainField", "/dev/ui", "section:has(h2:text-is('DomainField'))"],
  ["onboarding step 1", "/dev/onboarding", '[data-state="1 empty"]'],
] as const)
  test(`${where}: the field's radius = the button's radius + the inset gap`, async ({ page }) => {
    // UI1: below md onboarding's button moves to the sticky bar, so there's no inner button to nest.
    test.skip(path === "/dev/onboarding" && page.viewportSize()!.width < 768, "the phone bar holds the button");
    await page.goto(path);
    const field = page.locator(scope).locator("[data-field]").first();
    await expect(field).toBeVisible();
    const { outer, inner, right, bottom } = await nested(field);
    expect(inner).toBe(6);
    expect(right).toBeGreaterThan(0);
    expect(bottom).toBeCloseTo(right, 0);
    expect(outer).toBeCloseTo(inner + right, 0);
  });
