import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

// POST only, so a prefetch or a link can't sign anyone out; same-origin only, so another site's form can't either.
// 303 turns the POST into a GET of /signin.
export async function POST(request: NextRequest) {
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  const sameOrigin = site ? site === "same-origin" : origin === request.nextUrl.origin;
  if (!sameOrigin) return new NextResponse(null, { status: 403 });
  if (!supabaseEnv()) return NextResponse.redirect(new URL("/signin?error=config", request.url), 303);
  const db = await createClient();
  await db.auth.signOut();
  return NextResponse.redirect(new URL("/signin", request.url), 303);
}
