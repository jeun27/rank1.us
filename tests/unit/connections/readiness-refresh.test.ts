import { describe, expect, it, vi } from "vitest";
import { refreshReadiness, type ReadinessDeps } from "@/lib/connections/readiness";

const base = () => ({
  business: vi
    .fn<ReadinessDeps["business"]>()
    .mockResolvedValue({ name: "Example Ramen House", vertical: "restaurant" }),
  refresh: vi.fn<ReadinessDeps["refresh"]>().mockResolvedValue({ ready: true, newlyReady: true }),
  send: vi.fn<ReadinessDeps["send"]>().mockResolvedValue(true),
  env: {
    TEAM_NOTIFY_EMAIL: "team@example.com",
    CONTACT_FROM_EMAIL: "hello@example.com",
    NEXT_PUBLIC_SITE_URL: "https://rank1.example",
  } as Record<string, string | undefined>,
  log: vi.fn<(l: string) => void>(),
});
const deps = (p: Partial<ReturnType<typeof base>> = {}) => ({ ...base(), ...p });

describe("refreshReadiness", () => {
  it("refreshes with the business's readiness set (Recommended ∩ live)", async () => {
    const d = deps();
    await refreshReadiness("biz-1", d);
    expect(d.refresh).toHaveBeenCalledWith("biz-1", ["gbp"]);
    const saas = deps({ business: vi.fn().mockResolvedValue({ name: "Example Software", vertical: "saas" }) });
    await refreshReadiness("biz-2", saas);
    expect(saas.refresh).toHaveBeenCalledWith("biz-2", ["search_console"]);
  });

  it("newly ready + TEAM_NOTIFY_EMAIL set → one team email, idempotent per business and day", async () => {
    const d = deps();
    expect(await refreshReadiness("biz-1", d, new Date("2026-11-06T08:00:00Z"))).toEqual({
      ready: true,
      newlyReady: true,
      emailed: true,
    });
    expect(d.send).toHaveBeenCalledTimes(1);
    const [email, key] = d.send.mock.calls[0];
    expect(email).toEqual({
      from: "hello@example.com",
      to: "team@example.com",
      reply_to: "team@example.com",
      subject: "Example Ramen House is ready for GAS",
      text: "Business Profile connected.\n\nStart on the fix list: https://rank1.example/team",
    });
    expect(key).toBe("gas-ready-biz-1-2026-11-06");
  });

  it("TEAM_NOTIFY_EMAIL unset (today) → no email, even when newly ready", async () => {
    const d = deps({ env: { CONTACT_FROM_EMAIL: "hello@example.com" } });
    expect(await refreshReadiness("biz-1", d)).toEqual({ ready: true, newlyReady: true, emailed: false });
    expect(d.send).not.toHaveBeenCalled();
  });

  it("already ready, or not ready → no email", async () => {
    for (const r of [
      { ready: true, newlyReady: false },
      { ready: false, newlyReady: false },
    ]) {
      const d = deps({ refresh: vi.fn().mockResolvedValue(r) });
      expect((await refreshReadiness("biz-1", d)).emailed).toBe(false);
      expect(d.send).not.toHaveBeenCalled();
    }
  });

  it("never throws: a failure is logged with its code only", async () => {
    const d = deps({
      refresh: vi.fn().mockRejectedValue(Object.assign(new Error("Example Ramen House"), { code: "42501" })),
    });
    expect(await refreshReadiness("biz-1", d)).toEqual({ ready: false, newlyReady: false, emailed: false });
    expect(d.log.mock.calls.flat()).toEqual(["connections: gas readiness failed (42501)"]);
    const gone = deps({ business: vi.fn().mockResolvedValue(null) });
    expect(await refreshReadiness("biz-1", gone)).toEqual({ ready: false, newlyReady: false, emailed: false });
    expect(gone.refresh).not.toHaveBeenCalled();
  });

  it("the email names every connection in the set, joined with 'and'", async () => {
    const d = deps({ business: vi.fn().mockResolvedValue({ name: "Example Shop", vertical: "dtc" }) });
    await refreshReadiness("biz-3", d);
    expect(d.send.mock.calls[0][0].text.split("\n")[0]).toBe("Search Console connected.");
  });
});
