import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

afterEach(() => vi.unstubAllEnvs());

describe("/app is behind ENABLE_TEAM_WORKSPACE", () => {
  it.each([undefined, "", "false", "1", "TRUE"])("404s when the flag is %s", async (value) => {
    vi.stubEnv("ENABLE_TEAM_WORKSPACE", value);
    const { default: AppPage } = await import("@/app/app/page");
    expect(() => AppPage()).toThrow("NEXT_NOT_FOUND");
  });

  it('renders when the flag is "true"', async () => {
    vi.stubEnv("ENABLE_TEAM_WORKSPACE", "true");
    const { default: AppPage } = await import("@/app/app/page");
    expect(AppPage()).toBeTruthy();
  });

  it(".env.example lists the flag, off by default", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync(".env.example", "utf8")).toMatch(/^ENABLE_TEAM_WORKSPACE=false # .+$/m);
  });
});
