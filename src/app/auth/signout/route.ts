import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST only, so a prefetch or a link can't sign anyone out. 303 turns the POST into a GET of /signin.
export async function POST(request: NextRequest) {
  const db = await createClient();
  await db.auth.signOut();
  return NextResponse.redirect(new URL("/signin", request.url), 303);
}
