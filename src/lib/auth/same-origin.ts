import type { NextRequest } from "next/server";

// Sec-Fetch-Site when the browser sends it, else a matching Origin. Anything else is another site's form or script.
export function isSameOrigin(request: NextRequest) {
  const site = request.headers.get("sec-fetch-site");
  return site ? site === "same-origin" : request.headers.get("origin") === request.nextUrl.origin;
}
