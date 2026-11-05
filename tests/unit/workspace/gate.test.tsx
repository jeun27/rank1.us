import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Lead, 2026-11-05: with the flag off a signed-in team user gets the placeholder (was a 404 before sign-in existed).
// The role check is AreaGate's (tests/unit/auth/area-gate.test.tsx); this is what a team user sees.
vi.mock("@/components/workspace/Workspace", () => ({ Workspace: () => <div>team workspace</div> }));
// Real data loads through RLS (tests/e2e/team-real.spec.ts); here only the flag matters.
vi.mock("@/app/team/load", async () => {
  const { exampleWorkspaceRows } = await import("@/app/team/example-data");
  return { loadTeam: async () => ({ kind: "ok", rows: exampleWorkspaceRows(), extras: null }) };
});

afterEach(() => vi.unstubAllEnvs());

describe("/team is behind ENABLE_TEAM_WORKSPACE", () => {
  it.each([undefined, "", "false", "1", "TRUE"])(
    "shows the placeholder, not the workspace, when the flag is %s",
    async (value) => {
      vi.stubEnv("ENABLE_TEAM_WORKSPACE", value);
      const { TeamView } = await import("@/app/team/page");
      render(await TeamView({}));
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Dashboard");
      expect(screen.queryByText("team workspace")).toBeNull();
    },
  );

  it('renders the workspace when the flag is "true"', async () => {
    vi.stubEnv("ENABLE_TEAM_WORKSPACE", "true");
    const { TeamView } = await import("@/app/team/page");
    render(await TeamView({}));
    expect(screen.getByText("team workspace")).toBeInTheDocument();
  });

  it(".env.example lists the flag, off by default", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync(".env.example", "utf8")).toMatch(/^ENABLE_TEAM_WORKSPACE=false # .+$/m);
  });
});
