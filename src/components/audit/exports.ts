// Download headers for the CSV and PNG exports: attachments, never cached or indexed, no referrer.
export function exportHeaders(kind: "csv" | "png", filename: string): Record<string, string> {
  return {
    "Content-Type": kind === "csv" ? "text/csv; charset=utf-8" : "image/png",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
  };
}

// "rank1-audit-{label}-{yyyy-mm-dd}.{ext}", with only [a-z0-9.-] so the header can't be broken.
export function exportFilename(label: string, finishedAt: string | null, ext: "csv" | "png"): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const day = finishedAt ? `-${finishedAt.slice(0, 10)}` : "";
  return `rank1-audit-${slug}${day}.${ext}`;
}
