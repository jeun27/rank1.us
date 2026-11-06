import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
afterEach(() => vi.unstubAllEnvs());

// QA #89 F1: 'Connect GA4' points at the Connections hub only when it exists; off in prod.
describe("ga4ConnectHref", () => {
  it("is /app/settings/connections when ENABLE_CONNECTIONS is 'true'", async () => {
    vi.stubEnv("ENABLE_CONNECTIONS", "true");
    const { ga4ConnectHref } = await import("@/app/app/report/ga4");
    expect(ga4ConnectHref()).toBe("/app/settings/connections");
  });

  it.each([undefined, "", "false", "1", "TRUE"])("is null when the flag is %s", async (v) => {
    vi.stubEnv("ENABLE_CONNECTIONS", v);
    const { ga4ConnectHref } = await import("@/app/app/report/ga4");
    expect(ga4ConnectHref()).toBeNull();
  });
});
