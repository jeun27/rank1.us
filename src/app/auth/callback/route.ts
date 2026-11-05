import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { landingPath, safeNext } from "@/lib/auth/next";
import { ensureSelfServeWorkspace, getLanding } from "@/lib/queries/auth";
import { createClient } from "@/lib/supabase/server";

const EMAIL_TYPES: EmailOtpType[] = ["magiclink", "email", "signup", "invite"];

// Google and email links both land here: ?code (PKCE) or ?token_hash&type (email template link).
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const next = safeNext(q.get("next"));
  const tokenHash = q.get("token_hash");
  const type = q.get("type") as EmailOtpType | null;
  const viaEmail = q.get("via") === "email" || tokenHash !== null;
  const go = (path: string) => NextResponse.redirect(new URL(path, request.url));
  const fail = () =>
    go(`/signin?error=${viaEmail ? "link" : "google"}${next ? `&next=${encodeURIComponent(next)}` : ""}`);

  const db = await createClient();
  const code = q.get("code");
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
