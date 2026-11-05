import { NextResponse, type NextRequest } from "next/server";
import { NEXT_COOKIE, safeNext } from "@/lib/auth/next";
import { isSameOrigin } from "@/lib/auth/same-origin";

// The magic-link form stores next here (httpOnly, so page JS can't read it); /auth/callback reads it.
// Same-origin only, so another site can't plant a next for the user's sign-in.
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return new NextResponse(null, { status: 403 });
  const body: unknown = await request.json().catch(() => null);
  const raw = body && typeof body === "object" && "next" in body ? body.next : null;
  const next = typeof raw === "string" ? safeNext(raw) : null;
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(NEXT_COOKIE, next ?? "", {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/auth",
    maxAge: next ? 600 : 0,
  });
  return res;
}
