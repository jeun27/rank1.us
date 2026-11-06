import { describe, expect, it } from "vitest";
import { connectionsFlag } from "../../e2e/helpers/connections-flag";

// #118 S1: the flag-off e2e skips only on a clear "on". 404 is off (run), 400/503 is on (skip), and
// anything else (401 preview protection, 500, a redirect) throws so the test fails loudly.
describe("connectionsFlag", () => {
  it("404 means off", () => expect(connectionsFlag(404)).toBe("off"));
  it.each([400, 503])("%i means on", (s) => expect(connectionsFlag(s)).toBe("on"));
  it.each([200, 302, 307, 401, 403, 500, 502])("%i throws, naming the status", (s) =>
    expect(() => connectionsFlag(s)).toThrow(String(s)),
  );
});
