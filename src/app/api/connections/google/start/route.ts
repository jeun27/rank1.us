import { NextResponse, type NextRequest } from "next/server";
import {
  GOOGLE_SCOPES,
  returnUrl,
  safeReturn,
  siteOrigin,
  STATE_COOKIE,
  stateCookieOptions,
  type GoogleConnector,
} from "@/lib/connections/oauth";
import { beginGoogleConnect, connectionsEnabled } from "@/lib/connections/service";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// GET /api/connections/google/start?business=<id>&connector=gbp|search_console|ga4&return=<path>
// Off (404) unless ENABLE_CONNECTIONS=true, checked before anything else.
export async function GET(req: NextRequest) {
  if (!connectionsEnabled()) return new NextResponse(null, { status: 404 });
  try {
    siteOrigin();
  } catch {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const q = req.nextUrl.searchParams;
  const businessId = q.get("business");
  const connector = q.get("connector");
  if (!businessId || !connector || !(connector in GOOGLE_SCOPES))
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const returnTo = safeReturn(q.get("return"));
  const r = await beginGoogleConnect(
    { userDb: await createClient(), serviceDb: createServiceClient() },
    { businessId, connector: connector as GoogleConnector, returnTo },
  );
  if (typeof r === "string") return NextResponse.redirect(returnUrl(returnTo, { connection: connector, status: r }));
  const res = NextResponse.redirect(r.url);
  res.cookies.set(STATE_COOKIE, r.cookie, stateCookieOptions);
  return res;
}
