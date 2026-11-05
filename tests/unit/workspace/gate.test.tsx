import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Lead, 2026-11-05: with the flag off a signed-in team user gets the placeholder (was a 404 before sign-in existed).
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
vi.mock("@/lib/queries/auth", () => ({ getLanding: async () => "team" }));
vi.mock("@/components/workspace/Workspace", () => ({ Workspace: () => <div>team workspace</div> }));

afterEach(() => vi.unstubAllEnvs());

describe("/team is behind ENABLE_TEAM_WORKSPACE", () => {
  it.each([undefined, "", "false", "1", "TRUE"])(
    "shows the placeholder, not the workspace, when the flag is %s",
    async (value) => {
      vi.stubEnv("ENABLE_TEAM_WORKSPACE", value);
      const { TeamGate } = await import("@/app/team/page");
      render(await TeamGate());
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Dashboard");
      expect(screen.queryByText("team workspace")).toBeNull();
    },
  );

  it('renders the workspace when the flag is "true"', async () => {
    vi.stubEnv("ENABLE_TEAM_WORKSPACE", "true");
    const { TeamGate } = await import("@/app/team/page");
    render(await TeamGate());
    expect(screen.getByText("team workspace")).toBeInTheDocument();
  });

  it(".env.example lists the flag, off by default", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync(".env.example", "utf8")).toMatch(/^ENABLE_TEAM_WORKSPACE=false # .+$/m);
  });
});
