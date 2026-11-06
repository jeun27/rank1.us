import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { selectedBusinessId } from "@/app/app/current";
import { ReportView } from "@/components/report/ReportView";
import { getLogoUrl, getReportSettings, listReports } from "@/lib/queries/reports";
import { getCurrentBusiness } from "@/lib/queries/shell";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { saveReportSettings, sendReportTest, uploadReportLogo } from "./actions";

export const metadata: Metadata = { title: "Reports - Rank1", robots: { index: false } };

// UI.md 4b Report for the current business: settings, the real PDF preview, test send and history.
export default async function ReportPage() {
  await connection();
  const db = await createClient();
  const business = await getCurrentBusiness(db, await selectedBusinessId());
  if (!business) redirect("/app");
  const [settings, reports, logoUrl] = await Promise.all([
    getReportSettings(db, business.id),
    listReports(db, business.id),
    getLogoUrl(db, createServiceClient(), business.id).catch(() => null),
  ]);
  return (
    <ReportView
      settings={{
        brand_color: settings?.brand_color ?? null,
        report_recipients: settings?.report_recipients ?? [],
        logoUrl,
      }}
      reports={reports}
      previewSrc="/app/report/preview.pdf"
      actions={{ save: saveReportSettings, uploadLogo: uploadReportLogo, sendTest: sendReportTest }}
    />
  );
}
