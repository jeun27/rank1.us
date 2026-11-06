import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, type Route } from "@playwright/test";

export const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

// Stands in for Cloudflare's api.js: render() adds the hidden cf-turnstile-response input and calls back
// with the token like the real widget (the audit form waits for the callback).
export async function stubTurnstile(page: Page) {
  await page.route("https://challenges.cloudflare.com/**", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.turnstile = {
        render(el, o) { const i = document.createElement("input"); i.type = "hidden"; i.name = "cf-turnstile-response"; i.value = ${JSON.stringify(DUMMY_TOKEN)}; el.appendChild(i); setTimeout(() => o && o.callback && o.callback(${JSON.stringify(DUMMY_TOKEN)})); return "w1"; },
        reset() {}, remove() {}
      };`,
    }),
  );
}

// Answers a form API with a status after an optional hold, and records the JSON bodies.
export async function mockApi(page: Page, path: string, status: number, body: unknown = {}, hold?: Promise<void>) {
  const bodies: Record<string, unknown>[] = [];
  await page.route(`**${path}`, async (route: Route) => {
    bodies.push(route.request().postDataJSON());
    if (hold) await hold;
    await route.fulfill({ status, json: body });
  });
  return bodies;
}

export async function expectAxeClean(page: Page) {
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
}

export async function expectNoSideScroll(page: Page) {
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(w).toBeLessThanOrEqual(page.viewportSize()!.width);
}
