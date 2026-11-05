import { NextResponse, type NextRequest } from "next/server";
import { NEXT_COOKIE, safeNext } from "@/lib/auth/next";

// The magic-link form stores next here (httpOnly, so page JS can't read or forge it); /auth/callback reads it.
export async function POST(request: NextRequest) {
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
