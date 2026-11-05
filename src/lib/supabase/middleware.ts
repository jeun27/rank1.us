import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isProtected, signInPath } from "@/lib/auth/next";
import { supabaseEnv } from "./env";

// Refreshes the session cookie on every request and sends signed-out visitors of /app, /team and /client to /signin.
export async function updateSession(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const env = supabaseEnv();
  // Supabase not connected: public pages still work, app areas stay closed.
  if (!env)
    return isProtected(pathname)
      ? NextResponse.redirect(new URL(signInPath(pathname, search), request.url))
      : NextResponse.next({ request });

  let response = NextResponse.next({ request });
  let cacheHeaders: Record<string, string> = {};
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          cacheHeaders = headers;
        },
      },
    },
  );

  // getClaims verifies the JWT; nothing may run between createServerClient and this call.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims && isProtected(pathname)) {
    const redirect = NextResponse.redirect(new URL(signInPath(pathname, search), request.url));
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    response = redirect;
  }
  for (const [key, value] of Object.entries(cacheHeaders)) response.headers.set(key, value);
  return response;
}
