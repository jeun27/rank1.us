import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { landingPath, NEXT_COOKIE, safeNext } from "@/lib/auth/next";
import { ensureSelfServeWorkspace, getLanding } from "@/lib/queries/auth";
import { supabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const EMAIL_TYPES: EmailOtpType[] = ["magiclink", "signup", "email"];

// Google returns ?code (PKCE). Email links carry ?token_hash&type (HANDOFF.md templates), so they work in any browser.
// Anything else, e.g. tokens in a #fragment the server never sees, is a broken email link.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const next = safeNext(q.get("next") ?? request.cookies.get(NEXT_COOKIE)?.value);
  const code = q.get("code");
  const tokenHash = q.get("token_hash");
  const type = q.get("type") as EmailOtpType | null;
  const google = code !== null || (q.has("error") && tokenHash === null);
  // Cleared through the same store the Supabase client writes the session to, so Next keeps both.
  const store = await cookies();
  if (store.has(NEXT_COOKIE)) store.set(NEXT_COOKIE, "", { path: "/auth", maxAge: 0 });
  const go = (path: string) => NextResponse.redirect(new URL(path, request.url));
  const fail = () =>
    go(`/signin?error=${google ? "google" : "link"}${next ? `&next=${encodeURIComponent(next)}` : ""}`);

  if (!supabaseEnv()) return go("/signin?error=config");
  const db = await createClient();
  let signedIn = false;
  if (code) signedIn = !(await db.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type && EMAIL_TYPES.includes(type))
    signedIn = !(await db.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  if (!signedIn) return fail();

  try {
    await ensureSelfServeWorkspace(db);
    const landing = await getLanding(db);
    return landing ? go(landingPath(landing, next)) : fail();
  } catch {
    return fail();
  }
}
