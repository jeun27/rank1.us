import { call, type Deps } from "./google-api";

// Search Console sites the Google account can see (read-only; webmasters.readonly).
// https://developers.google.com/webmaster-tools/v1/sites/list
// Read access = any verified permission; siteUnverifiedUser can't read data.
export async function listSites(token: string, deps: Deps = {}) {
  const body = await call(token, "https://www.googleapis.com/webmasters/v3/sites", deps);
  const entries = (body.siteEntry as { siteUrl: string; permissionLevel: string }[] | undefined) ?? [];
  return entries.map((s) => ({
    siteUrl: s.siteUrl,
    permissionLevel: s.permissionLevel,
    readable: s.permissionLevel !== "siteUnverifiedUser",
  }));
}
