import { decryptToken, encryptToken } from "./crypto";
import { GoogleApiError } from "./google-api";
import { OAuthError } from "./oauth";

const REFRESH_EARLY_MS = 60_000;

export type ConnectionStatus = "connected" | "needs_reauth" | "revoked";
// Ciphertext only ("v1.iv.tag.ct"); plaintext tokens never leave this module.
export type StoredTokens = {
  encAccess: string;
  encRefresh: string | null;
  expiresAt: string;
  status: ConnectionStatus;
};

export type TokenDeps = {
  load: (connectionId: string) => Promise<StoredTokens | null>;
  // encRefresh null = keep the stored refresh token.
  save: (connectionId: string, t: { encAccess: string; encRefresh: string | null; expiresAt: string }) => Promise<void>;
  needsReauth: (connectionId: string) => Promise<void>;
  refresh: (refreshToken: string) => Promise<{ accessToken: string; refreshToken: string | null; expiresAt: string }>;
  key: Buffer;
  now?: () => number;
};

export type ConnectionReason = "not_connected" | "revoked" | "needs_reauth" | "refresh_failed";
export class ConnectionError extends Error {
  constructor(readonly reason: ConnectionReason) {
    super(reason);
  }
}

async function refreshed(connectionId: string, t: StoredTokens, deps: TokenDeps): Promise<string> {
  if (!t.encRefresh) {
    await deps.needsReauth(connectionId);
    throw new ConnectionError("needs_reauth");
  }
  let next: Awaited<ReturnType<TokenDeps["refresh"]>>;
  try {
    next = await deps.refresh(decryptToken(t.encRefresh, deps.key));
  } catch (e) {
    // Revoked or expired at Google: say so (the dashboard card shows) and never retry silently.
    if (e instanceof OAuthError && e.reason === "reauth") {
      await deps.needsReauth(connectionId);
      throw new ConnectionError("needs_reauth");
    }
    throw new ConnectionError("refresh_failed");
  }
  await deps.save(connectionId, {
    encAccess: encryptToken(next.accessToken, deps.key),
    encRefresh: next.refreshToken ? encryptToken(next.refreshToken, deps.key) : null,
    expiresAt: next.expiresAt,
  });
  return next.accessToken;
}

// Runs `call` with a valid access token: refreshed when within 60 s of expiry, and once more after a 401.
// A second 401 (or invalid_grant) marks the connection needs_reauth. Other Google errors pass through.
export async function withGoogleToken<T>(
  connectionId: string,
  call: (accessToken: string) => Promise<T>,
  deps: TokenDeps,
): Promise<T> {
  const t = await deps.load(connectionId);
  if (!t) throw new ConnectionError("not_connected");
  if (t.status !== "connected") throw new ConnectionError(t.status);
  const now = (deps.now ?? Date.now)();
  const token =
    Date.parse(t.expiresAt) - now > REFRESH_EARLY_MS
      ? decryptToken(t.encAccess, deps.key)
      : await refreshed(connectionId, t, deps);
  try {
    return await call(token);
  } catch (e) {
    if (!(e instanceof GoogleApiError) || e.status !== 401) throw e;
  }
  const again = await refreshed(connectionId, t, deps);
  try {
    return await call(again);
  } catch (e) {
    if (e instanceof GoogleApiError && e.status === 401) {
      await deps.needsReauth(connectionId);
      throw new ConnectionError("needs_reauth");
    }
    throw e;
  }
}
