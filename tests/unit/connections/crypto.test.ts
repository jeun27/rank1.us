import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken, tokenKey, TokenKeyError } from "@/lib/connections/crypto";

const KEY = randomBytes(32).toString("base64");
const TOKEN = "ya29.example-access-token-not-real";

describe("token encryption (AES-256-GCM)", () => {
  it("round-trips, in the v1.iv.tag.ct format, never containing the plaintext", () => {
    const key = tokenKey({ GOOGLE_TOKEN_ENCRYPTION_KEY: KEY });
    const enc = encryptToken(TOKEN, key);
    expect(enc).toMatch(/^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]+$/);
    expect(enc).not.toContain(TOKEN);
    expect(decryptToken(enc, key)).toBe(TOKEN);
  });

  it("uses a fresh IV every time", () => {
    const key = tokenKey({ GOOGLE_TOKEN_ENCRYPTION_KEY: KEY });
    expect(encryptToken(TOKEN, key)).not.toBe(encryptToken(TOKEN, key));
  });

  it("rejects a tampered ciphertext, IV or tag, a wrong key, and an unknown version", () => {
    const key = tokenKey({ GOOGLE_TOKEN_ENCRYPTION_KEY: KEY });
    const [v, iv, tag, ct] = encryptToken(TOKEN, key).split(".");
    const flip = (s: string) => (s[0] === "A" ? "B" : "A") + s.slice(1);
    for (const bad of [
      [v, iv, tag, flip(ct)],
      [v, flip(iv), tag, ct],
      [v, iv, flip(tag), ct],
      ["v2", iv, tag, ct],
      [v, iv, tag],
    ])
      expect(() => decryptToken(bad.join("."), key)).toThrow();
    const other = tokenKey({ GOOGLE_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64") });
    expect(() => decryptToken([v, iv, tag, ct].join("."), other)).toThrow();
  });

  it("a missing or non-32-byte key is not_configured, and the error never echoes the key", () => {
    for (const k of [
      undefined,
      "",
      "c2hvcnQ=",
      randomBytes(16).toString("base64"),
      randomBytes(33).toString("base64"),
    ]) {
      try {
        tokenKey({ GOOGLE_TOKEN_ENCRYPTION_KEY: k });
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(TokenKeyError);
        expect((e as Error).message).toBe("not_configured");
        if (k) expect(String(e)).not.toContain(k);
      }
    }
  });
});
