import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { admin, newUser, openMagicLink } from "./helpers/auth";

// v0.8.0 blocker: #161's loadQueue made 5 PostgREST calls per DFY client, and at ~120 clients Kong ran out
// of connections and /team returned 500. With team_client_queue() (#169) the queue is one call. 150 seeded
// DFY clients: /team is 200 and opens on the queue with every one of them. Needs the local Supabase stack.
test.skip(Boolean(process.env.E2E_BASE_URL), "needs local Supabase");
test.setTimeout(120_000);

const must = <T>(r: { data: T; error: unknown }): NonNullable<T> => {
  if (r.error) throw r.error;
  return r.data as NonNullable<T>;
};

test("150 DFY clients: /team is 200 and the queue lists them all", async ({ page }) => {
  const tag = randomUUID().slice(0, 8);
  const owner = await newUser("owner-queue");
  const ws = must(
    await admin()
      .from("workspaces")
      .insert({ name: "Example Workspace", owner_id: owner.id, subscription_status: "active", seats_quantity: 1 })
      .select("id")
      .single(),
  );
  // DFY businesses don't take seats, so one workspace holds them all.
  const names = Array.from({ length: 150 }, (_, i) => `Example Queue ${tag} ${String(i).padStart(3, "0")}`);
  const ids = must(
    await admin()
      .from("businesses")
      .insert(
        names.map((name) => ({ workspace_id: ws.id, name, service: "dfy" as const, domain: "exampleramen.test" })),
      )
      .select("id"),
  ).map((b) => b.id);
  try {
    await openMagicLink(page, (await newUser("team-queue", "team")).email);
    const res = await page.goto("/team");
    expect(res?.status()).toBe(200);
    // The page streams, so the old fan-out still answered 200 and then the error boundary replaced it
    // ("fetch failed: other side closed" from Kong in the server log).
    await expect(page.getByRole("heading", { name: "This page couldn’t load" })).toHaveCount(0);
    const table = page.getByRole("table", { name: "Clients" });
    const seeded = table.locator("tbody tr", { hasText: `Example Queue ${tag}` });
    await expect(seeded).toHaveCount(150);
    await expect(table.getByRole("link", { name: names[0] })).toHaveAttribute("href", `/team?b=${ids[0]}`);
    await expect(table.getByRole("link", { name: names[149] })).toBeVisible();
    for (const theme of ["dark", "light"] as const) {
      // The theme is set on load, so switch the scheme and reload.
      await page.emulateMedia({ colorScheme: theme });
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(seeded).toHaveCount(150);
      await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"));
      await page.screenshot({
        path: `test-results/screenshots/team-queue-150-${theme}-${test.info().project.name}.png`,
      });
    }
  } finally {
    // The local stack is shared: archive the seeded clients so other tests' queues stay small.
    await admin().from("businesses").update({ archived_at: new Date().toISOString() }).in("id", ids);
  }
});
