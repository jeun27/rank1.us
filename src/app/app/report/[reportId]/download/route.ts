import { NextResponse, type NextRequest } from "next/server";
import { getReportDownloadUrl } from "@/lib/queries/reports";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// A short-lived signed URL, minted per click after RLS confirms the caller can read the report row.
// Nothing is stored or cached; an unknown or unreadable report is a 404.
export async function GET(_req: NextRequest, { params }: RouteContext<"/app/report/[reportId]/download">) {
  const { reportId } = await params;
  const url = await getReportDownloadUrl(await createClient(), createServiceClient(), reportId).catch(() => null);
  if (!url) return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
}
