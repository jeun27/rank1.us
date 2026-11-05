import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
const getLanding = vi.fn();
vi.mock("@/lib/queries/auth", () => ({ getLanding: () => getLanding() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
}));

const { AreaGate } = await import("@/components/auth/AreaGate");
const gate = (area: "/app" | "/team" | "/client") => AreaGate({ area, children: <p>inside</p> });

beforeEach(() => getLanding.mockReset());

describe("AreaGate", () => {
  it.each([
    ["/app", "onboarding"],
    ["/app", "dashboard"],
    ["/team", "team"],
    ["/client", "dfy_client"],
  ] as const)("lets %s through for %s", async (area, landing) => {
    getLanding.mockResolvedValue(landing);
    render(await gate(area));
    expect(screen.getByText("inside")).toBeInTheDocument();
  });

  it.each([
    ["/app", "team", "/team"],
    ["/app", "dfy_client", "/client"],
    ["/team", "dashboard", "/app"],
    ["/team", "onboarding", "/app/onboarding"],
    ["/team", "dfy_client", "/client"],
    ["/client", "team", "/team"],
    ["/client", "dashboard", "/app"],
  ] as const)("sends a wrong role in %s (%s) to %s", async (area, landing, to) => {
    getLanding.mockResolvedValue(landing);
    await expect(gate(area)).rejects.toThrow(`redirect ${to}`);
  });

  it.each(["/app", "/team", "/client"] as const)(
    "sends a signed-out visitor of %s to /signin with it as next",
    async (area) => {
      getLanding.mockResolvedValue(null);
      await expect(gate(area)).rejects.toThrow(`redirect /signin?next=${encodeURIComponent(area)}`);
    },
  );
});
