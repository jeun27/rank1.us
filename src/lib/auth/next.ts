import type { Landing } from "@/lib/queries/auth";

const AREAS = ["/app", "/team", "/client"] as const;
const inArea = (path: string, area: string) =>
  path === area || path.startsWith(`${area}/`) || path.startsWith(`${area}?`);

export const isProtected = (path: string) => AREAS.some((a) => inArea(path, a));

export const signInPath = (path: string, search = "") => `/signin?next=${encodeURIComponent(path + search)}`;

// A same-origin path only: rejects protocol-relative, backslash, encoded-slash and whitespace tricks.
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/") || /^\/[/\\]|^\/%2f|[\s\\]/i.test(raw)) return null;
  return new URL(raw, "http://x").origin === "http://x" ? raw : null;
}

const HOME: Record<Landing, string> = {
  team: "/team",
  dfy_client: "/client",
  onboarding: "/app/onboarding",
  dashboard: "/app",
};
const AREA: Record<Landing, string> = { team: "/team", dfy_client: "/client", onboarding: "/app", dashboard: "/app" };

// next wins when it stays in the user's own area or is a public page (never /signin or /auth).
export function landingPath(landing: Landing, rawNext: string | null): string {
  const next = safeNext(rawNext);
  if (!next || inArea(next, "/signin") || inArea(next, "/auth")) return HOME[landing];
  if (inArea(next, AREA[landing]) || !isProtected(next)) return next;
  return HOME[landing];
}
