import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// X5 (UX plan PR 19): /team opens on the client queue, sorted Needs attention → Ready for GAS →
// Waiting on client → In progress, status on the left, and a row opens that client.
for (const theme of ["dark", "light"] as const)
  test(`client queue (${theme}): first document, sorted, each row opens its client, axe clean`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/dev/team?state=queue");
    // The Clients document is the open tab (the page H1 stays the rail section, as before).
    await expect(page.getByRole("tablist", { name: "Document" }).getByRole("tab", { selected: true })).toHaveText(
      /Clients/,
    );
    const table = page.getByRole("table", { name: "Clients" });
    const rows = table.locator("tbody tr");
    await expect(rows).toHaveCount(4);
    await expect(rows.locator("td:first-child")).toHaveText([
      "Needs attention",
      "Ready for GAS",
      "Waiting on client",
      "In progress",
    ]);
    await expect(rows.first()).toContainText("named in 48 of 240 answers");
    await expect(rows.first().getByRole("link")).toHaveAttribute("href", "/dev/team?b=example-client-4");
    await expect(rows.nth(2)).toContainText("–");
    // The invite panel stays below the queue.
    const invite = page.getByRole("button", { name: /Invite/ }).first();
    if (await invite.count()) expect((await invite.boundingBox())!.y).toBeGreaterThan((await table.boundingBox())!.y);
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
    expect((await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );
  });
