import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import "./no-live";
import { decryptToken, encryptToken } from "@/lib/connections/crypto";
import { GoogleApiError } from "@/lib/connections/google-api";
import { OAuthError } from "@/lib/connections/oauth";
import { ConnectionError, withGoogleToken, type StoredTokens, type TokenDeps } from "@/lib/connections/tokens";

const KEY = randomBytes(32);
const NOW = 1_800_000_000_000;
const stored = (over: Partial<StoredTokens> = {}): StoredTokens => ({
  encAccess: encryptToken("ya29.current", KEY),
  encRefresh: encryptToken("1//refresh", KEY),
  expiresAt: new Date(NOW + 30 * 60_000).toISOString(),
  status: "connected",
  ...over,
});

const base = () => ({
  load: vi.fn<TokenDeps["load"]>().mockResolvedValue(stored()),
  save: vi.fn<TokenDeps["save"]>().mockResolvedValue(undefined),
  needsReauth: vi.fn<TokenDeps["needsReauth"]>().mockResolvedValue(undefined),
  refresh: vi.fn<TokenDeps["refresh"]>().mockResolvedValue({
    accessToken: "ya29.fresh",
    refreshToken: null,
    expiresAt: new Date(NOW + 3600_000).toISOString(),
  }),
  key: KEY,
  now: () => NOW,
});
const deps = (p: Partial<ReturnType<typeof base>> = {}) => ({ ...base(), ...p });
const use = vi.fn(async (token: string) => `used ${token}`);

describe("withGoogleToken", () => {
  it("a token with over 60 s left is used as is, with no refresh", async () => {
    const d = deps();
    expect(await withGoogleToken("conn-1", use, d)).toBe("used ya29.current");
    expect(d.refresh).not.toHaveBeenCalled();
  });

  it("within 60 s of expiry it refreshes, stores the new token encrypted, and keeps the refresh token", async () => {
    const d = deps({ load: vi.fn().mockResolvedValue(stored({ expiresAt: new Date(NOW + 59_000).toISOString() })) });
    expect(await withGoogleToken("conn-1", use, d)).toBe("used ya29.fresh");
    expect(d.refresh).toHaveBeenCalledWith("1//refresh");
    const [id, saved] = d.save.mock.calls[0];
    expect(id).toBe("conn-1");
    expect(decryptToken(saved.encAccess, KEY)).toBe("ya29.fresh");
    expect(saved.encRefresh).toBeNull();
    expect(JSON.stringify(saved)).not.toContain("ya29.fresh");
  });

  it("a rotated refresh token is stored too", async () => {
    const d = deps({
      load: vi.fn().mockResolvedValue(stored({ expiresAt: new Date(NOW).toISOString() })),
      refresh: vi.fn().mockResolvedValue({ accessToken: "a", refreshToken: "1//rotated", expiresAt: "x" }),
    });
    await withGoogleToken("conn-1", use, d);
    expect(decryptToken(d.save.mock.calls[0][1].encRefresh!, KEY)).toBe("1//rotated");
  });

  it("invalid_grant on refresh → needs_reauth recorded, no retry", async () => {
    const d = deps({
      load: vi.fn().mockResolvedValue(stored({ expiresAt: new Date(NOW).toISOString() })),
      refresh: vi.fn().mockRejectedValue(new OAuthError("reauth")),
    });
    await expect(withGoogleToken("conn-1", use, d)).rejects.toMatchObject({ reason: "needs_reauth" });
    expect(d.needsReauth).toHaveBeenCalledWith("conn-1");
    expect(d.refresh).toHaveBeenCalledTimes(1);
  });

  it("a 401 from Google → one forced refresh and a retry; a second 401 → needs_reauth", async () => {
    const d = deps();
    const once = vi.fn().mockRejectedValueOnce(new GoogleApiError(401)).mockResolvedValueOnce("ok");
    expect(await withGoogleToken("conn-1", once, d)).toBe("ok");
    expect(once.mock.calls.map((c) => c[0])).toEqual(["ya29.current", "ya29.fresh"]);

    const d2 = deps();
    const always = vi.fn().mockRejectedValue(new GoogleApiError(401));
    await expect(withGoogleToken("conn-1", always, d2)).rejects.toMatchObject({ reason: "needs_reauth" });
    expect(always).toHaveBeenCalledTimes(2);
    expect(d2.needsReauth).toHaveBeenCalledWith("conn-1");
  });

  it("other Google errors pass through untouched (no status change)", async () => {
    const d = deps();
    const quota = vi.fn().mockRejectedValue(new GoogleApiError(429));
    await expect(withGoogleToken("conn-1", quota, d)).rejects.toMatchObject({ status: 429 });
    expect(d.needsReauth).not.toHaveBeenCalled();
    expect(d.refresh).not.toHaveBeenCalled();
  });

  it.each([
    [null, "not_connected"],
    [stored({ status: "revoked" }), "revoked"],
    [stored({ status: "needs_reauth" }), "needs_reauth"],
    [stored({ encRefresh: null, expiresAt: new Date(NOW).toISOString() }), "needs_reauth"],
  ] as const)("%# → %s, with no Google call", async (row, reason) => {
    const d = deps({ load: vi.fn().mockResolvedValue(row) });
    const err = await withGoogleToken("conn-1", use, d).catch((e) => e);
    expect(err).toBeInstanceOf(ConnectionError);
    expect(err.reason).toBe(reason);
    expect(d.refresh).not.toHaveBeenCalled();
  });

  it("a refresh outage → refresh_failed, status unchanged (next call tries again)", async () => {
    const d = deps({
      load: vi.fn().mockResolvedValue(stored({ expiresAt: new Date(NOW).toISOString() })),
      refresh: vi.fn().mockRejectedValue(new OAuthError("refresh_failed")),
    });
    await expect(withGoogleToken("conn-1", use, d)).rejects.toMatchObject({ reason: "refresh_failed" });
    expect(d.needsReauth).not.toHaveBeenCalled();
  });
});
