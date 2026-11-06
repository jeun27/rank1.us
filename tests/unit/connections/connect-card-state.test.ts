import { describe, expect, it } from "vitest";
import { connectCardState, READY_DAYS } from "@/lib/connections/connect-card";

// C-b (lead OK 2026-11-06): the dashboard card and the onboarding connect step read one state.
// Recommended = readinessSet(vertical), the same set refresh_gas_ready uses. "You're all set" shows for
// 7 days after gas_ready_at (lead Q2), then the card hides.
const NOW = new Date("2026-11-06T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const conn = (provider: "gbp" | "search_console" | "ga4", status: "connected" | "needs_reauth" | "revoked") => ({
  provider,
  status,
});

describe("connectCardState", () => {
  it("a restaurant with nothing connected: connect Business Profile", () => {
    expect(connectCardState({ industry: "restaurant", connections: [], readyAt: null, now: NOW })).toEqual({
      kind: "connect",
      rows: [{ connector: "gbp", status: "missing" }],
    });
  });

  it("saas needs Search Console", () => {
    expect(connectCardState({ industry: "saas", connections: [], readyAt: null, now: NOW })).toEqual({
      kind: "connect",
      rows: [{ connector: "search_console", status: "missing" }],
    });
  });

  it("an industry with nothing Recommended shows no card", () => {
    expect(connectCardState({ industry: "other", connections: [], readyAt: null, now: NOW })).toBeNull();
  });

  it("needs reauth and revoked keep the card, as Reconnect and Connect", () => {
    expect(
      connectCardState({ industry: "restaurant", connections: [conn("gbp", "needs_reauth")], readyAt: null, now: NOW }),
    ).toEqual({ kind: "connect", rows: [{ connector: "gbp", status: "needs_reauth" }] });
    expect(
      connectCardState({ industry: "restaurant", connections: [conn("gbp", "revoked")], readyAt: null, now: NOW }),
    ).toEqual({ kind: "connect", rows: [{ connector: "gbp", status: "missing" }] });
  });

  it("only Recommended connectors count: an Optional one connected doesn't fill the card", () => {
    expect(
      connectCardState({
        industry: "restaurant",
        connections: [conn("search_console", "connected")],
        readyAt: null,
        now: NOW,
      }),
    ).toEqual({ kind: "connect", rows: [{ connector: "gbp", status: "missing" }] });
  });

  it(`all set for ${READY_DAYS} days after readyAt, then hidden`, () => {
    const at = (d: number) =>
      connectCardState({
        industry: "restaurant",
        connections: [conn("gbp", "connected")],
        readyAt: daysAgo(d),
        now: NOW,
      });
    expect(READY_DAYS).toBe(7);
    expect(at(0)).toEqual({ kind: "ready", connectors: ["gbp"] });
    expect(at(6.99)).toEqual({ kind: "ready", connectors: ["gbp"] });
    expect(at(7)).toBeNull();
    expect(at(30)).toBeNull();
  });

  it("all connected but no readyAt yet: nothing to ask for, and no all-set card without its time", () => {
    expect(
      connectCardState({ industry: "restaurant", connections: [conn("gbp", "connected")], readyAt: null, now: NOW }),
    ).toBeNull();
  });

  it("a stale readyAt with a connection missing: the connect state wins", () => {
    expect(
      connectCardState({
        industry: "restaurant",
        connections: [conn("gbp", "needs_reauth")],
        readyAt: daysAgo(1),
        now: NOW,
      }),
    ).toEqual({ kind: "connect", rows: [{ connector: "gbp", status: "needs_reauth" }] });
  });
});
