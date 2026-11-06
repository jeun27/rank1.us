import { NextResponse, type NextRequest } from "next/server";
import { returnUrl, STATE_COOKIE, stateCookieOptions } from "@/lib/connections/oauth";
import { connectionsEnabled, finishGoogleConnect, type ConnectOutcome } from "@/lib/connections/service";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// Google's redirect URI: NEXT_PUBLIC_SITE_URL + /api/connections/google/callback (registered in the Google
// client). Off (404) unless ENABLE_CONNECTIONS=true. The state cookie is cleared on every outcome.
export async function GET(req: NextRequest) {
  if (!connectionsEnabled()) return new NextResponse(null, { status: 404 });
  const q = req.nextUrl.searchParams;
  let out: ConnectOutcome;
  try {
    out = await finishGoogleConnect(
      { userDb: await createClient(), serviceDb: createServiceClient() },
      {
        cookie: req.cookies.get(STATE_COOKIE)?.value,
        state: q.get("state"),
        code: q.get("code"),
        error: q.get("error"),
      },
    );
  } catch {
    // A DB failure: no detail in the URL or the log.
    console.error("connections: callback failed");
    out = { status: "error", connector: null, returnTo: "/app" };
  }
  const res = NextResponse.redirect(
    returnUrl(out.returnTo, { connection: out.connector, status: out.status }, req.url),
  );
  res.cookies.set(STATE_COOKIE, "", { ...stateCookieOptions, maxAge: 0 });
  return res;
}
