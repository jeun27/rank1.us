import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminPath, isFounder } from "@/lib/admin/is-founder";
import { isProtected, signInPath } from "@/lib/auth/next";
import { normalizePath } from "@/lib/auth/path";
import { supabaseEnv } from "./env";
import { createServiceClient } from "./service";

// The run and audit pages stream, so a run or token that doesn't exist must 404 here, before
// the page sends a 200 (notFound() in Suspense can't). The route is matched on the normalized
// path; the key comes from the raw one, because normalizePath lowercases and tokens are mixed-case.
export function resultTarget(pathname: string): { kind: "run" | "audit"; key: string } | null {
  const path = normalizePath(pathname);
  const kind =
    path && /^\/app\/runs\/[^/]+$/.test(path) ? "run" : path && /^\/audit\/[^/]+$/.test(path) ? "audit" : null;
  if (!kind) return null;
  const raw = pathname.split("/").filter(Boolean).at(-1)!;
  try {
    return { kind, key: decodeURIComponent(raw) };
  } catch {
    return null;
  }
}

// /app/experiments and /new stream (Step 17), so the dfy_client gate is a real 404 here (lead), on top of RLS.
export function experimentsTarget(pathname: string): boolean {
  const path = normalizePath(pathname);
  return path !== null && /^\/app\/experiments(\/new)?$/.test(path);
}

// /team?b=<id> streams too (Step 11): the client id, when the path is /team.
export function teamClient(pathname: string, params: URLSearchParams): string | null {
  return normalizePath(pathname) === "/team" ? params.get("b") || null : null;
}

// Paid runs are checked with the visitor's session (RLS), tokens with the service role (leads has
// no reader). Exports are route handlers and 404 on their own.
async function missingResult(
  pathname: string,
  params: URLSearchParams,
  supabase: ReturnType<typeof createServerClient>,
  signedIn: boolean,
) {
  // A DFY client the signed-in team user can read (RLS); anything else is gone. Flag off: the placeholder.
  const client = teamClient(pathname, params);
  if (client && signedIn && process.env.ENABLE_TEAM_WORKSPACE === "true") {
    const { data, error } = await supabase
      .from("businesses")
      .select("id")
      .eq("id", client)
      .eq("service", "dfy")
      .is("archived_at", null)
      .maybeSingle();
    return Boolean(error) || !data;
  }
  if (experimentsTarget(pathname) && signedIn) {
    const { data, error } = await supabase.rpc("my_landing");
    return Boolean(error) || data === "dfy_client";
  }
  const target = resultTarget(pathname);
  if (target?.kind === "run" && signedIn) {
    const { data, error } = await supabase
      .from("runs")
      .select("id")
      .eq("id", target.key)
      .in("kind", ["audit", "weekly"])
      .maybeSingle();
    return Boolean(error) || !data;
  }
  if (target?.kind === "audit") {
    const { data, error } = await createServiceClient()
      .from("leads")
      .select("run_id")
      .eq("token", target.key)
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
  if (
    (admin && !isFounder(data?.claims?.email)) ||
    (await missingResult(pathname, request.nextUrl.searchParams, supabase, Boolean(data?.claims)))
  ) {
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
