import { describe, expect, it } from "vitest";
import { settingsBlocked } from "@/lib/supabase/middleware";

// G4 (lead Q4): /app/settings/narrative follows ENABLE_NARRATIVE; the Settings index opens when either
// section is on; the connections pages keep ENABLE_CONNECTIONS.
const env = (c: boolean, n: boolean) => ({ ENABLE_CONNECTIONS: String(c), ENABLE_NARRATIVE: String(n) });

describe("settingsBlocked", () => {
  it.each([
    ["/app/settings", false, false, true],
    ["/app/settings", true, false, false],
    ["/app/settings", false, true, false],
    ["/app/settings/narrative", false, true, false],
    ["/app/settings/narrative", true, false, true],
    ["/APP/settings/narrative/", true, false, true],
    ["/app/settings/connections", false, true, true],
    ["/app/settings/connections", true, false, false],
    ["/client/settings/connections", false, true, true],
    ["/app/onboarding/connect", false, true, true],
    ["/app", false, false, false],
    ["/app/settings/narrativex", false, false, false],
  ] as const)("%s with connections=%s narrative=%s → blocked %s", (path, c, n, blocked) => {
    expect(settingsBlocked(path, env(c, n))).toBe(blocked);
  });
});
