import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";
import { exportFilename, exportHeaders } from "@/components/audit/exports";

describe("audit exports and token privacy", () => {
  it("downloads are attachments, never cached, never indexed", () => {
    expect(exportHeaders("csv", "rank1-audit-exampleramen.test-2026-11-05.csv")).toEqual({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="rank1-audit-exampleramen.test-2026-11-05.csv"',
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    });
    expect(exportHeaders("png", "x.png")["Content-Type"]).toBe("image/png");
  });

  it("filenames keep only safe characters", () => {
    expect(exportFilename("Example Ramen House", "2026-11-05T12:40:00Z", "csv")).toBe(
      "rank1-audit-example-ramen-house-2026-11-05.csv",
    );
    expect(exportFilename('evil"\r\nname', null, "png")).toBe("rank1-audit-evil-name.png");
  });

  it("every /audit page and export sends Referrer-Policy: no-referrer", async () => {
    const rules = await nextConfig.headers!();
    const audit = rules.find((r) => r.source === "/audit/:path*");
    expect(audit?.headers).toContainEqual({ key: "Referrer-Policy", value: "no-referrer" });
  });
});
