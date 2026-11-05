import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminPath, isFounder } from "@/lib/admin/is-founder";
import { isProtected, signInPath } from "@/lib/auth/next";
import { normalizePath } from "@/lib/auth/path";
import { supabaseEnv } from "./env";
import { createServiceClient } from "./service";

// The run and audit pages stream, so a run or token that doesn't exist must 404 here, before
// the page sends a 200. Paid runs are checked with the visitor's session (RLS), tokens with the
// service role (leads has no reader). Exports are route handlers and 404 on their own.
const RUN_PAGE = /^\/app\/runs\/([^/]+)$/;
const AUDIT_PAGE = /^\/audit\/([^/]+)$/;
async function missingResult(path: string, supabase: ReturnType<typeof createServerClient>, signedIn: boolean) {
  const run = RUN_PAGE.exec(path);
  if (run && signedIn) {
    const { data, error } = await supabase
      .from("runs")
      .select("id")
      .eq("id", decodeURIComponent(run[1]))
      .in("kind", ["audit", "weekly"])
      .maybeSingle();
    return Boolean(error) || !data;
  }
  const audit = AUDIT_PAGE.exec(path);
  if (audit) {
    const { data, error } = await createServiceClient()
      .from("leads")
      .select("run_id")
      .eq("token", decodeURIComponent(audit[1]))
      .maybeSingle();
    return Boolean(error) || !data?.run_id;
  }
  return false;
}

// Refreshes the session cookie on every request and sends signed-out visitors of /app, /team and /client to /signin.
export async function updateSession(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const env = supabaseEnv();
  // /admin is founder-only, and missing runs or audits are gone: a real 404 before the page streams a 200.
  const notFound = () => NextResponse.rewrite(new URL("/404", request.url), { status: 404 });
  // Checks run on the normalized path, so %61dmin, admin%2Ftest, //admin or /./app can't slip past them.
  const path = normalizePath(pathname);
  if (path === null) return notFound();
  const admin = isAdminPath(path);
  const gated = isProtected(path);
  // Supabase not connected: public pages still work, app areas stay closed.
  if (!env && admin) return notFound();
  if (!env)
    return gated
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
  if ((admin && !isFounder(data?.claims?.email)) || (await missingResult(path, supabase, Boolean(data?.claims)))) {
    const hidden = notFound();
    response.cookies.getAll().forEach((c) => hidden.cookies.set(c));
    response = hidden;
  } else if (!data?.claims && gated) {
    const redirect = NextResponse.redirect(new URL(signInPath(pathname, search), request.url));
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    response = redirect;
  }
  for (const [key, value] of Object.entries(cacheHeaders)) response.headers.set(key, value);
  return response;
}
