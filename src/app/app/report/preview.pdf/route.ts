import { NextResponse } from "next/server";
import { selectedBusinessId } from "@/app/app/current";
import { renderReportPreview } from "@/lib/reports/service";
import { getCurrentBusiness } from "@/lib/queries/shell";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// Last month's report for the current business: the real PDF, rendered with the caller's reads, never
// stored or sent (data-pipeline's renderReportPreview). 404 when RLS hides it, 500 on a render error.
export async function GET() {
  const db = await createClient();
  const business = await getCurrentBusiness(db, await selectedBusinessId());
  if (!business) return new NextResponse(null, { status: 404 });
  let pdf: Uint8Array | null;
  try {
    pdf = await renderReportPreview(db, createServiceClient(), business.id);
  } catch {
    return new NextResponse(null, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
  if (!pdf) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": "inline", "Cache-Control": "no-store" },
  });
}
