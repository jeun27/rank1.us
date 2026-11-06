import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { createElement } from "react";
import { toCsv, type MetricCitation } from "@/lib/metrics";
import { AuditImage } from "./AuditImage";
import { exportFilename, exportHeaders } from "./exports";
import type { Loaded } from "./load";

const notFound = () => new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

export function csvResponse(loaded: Loaded | null): Response {
  if (!loaded) return notFound();
  const { results } = loaded;
  const body = toCsv(results.answers, results.citations as MetricCitation[]);
  return new Response(body, {
    headers: exportHeaders("csv", exportFilename(results.label, results.run.finished_at, "csv")),
  });
}

// F1b: the PNG uses Inter like the app (latin subset, OFL, @fontsource/inter 5.3.0), not the renderer's
// default font. Satori reads woff, not woff2. next.config traces these files into both PNG routes.
const face = (weight: 400 | 600) => ({
  name: "Inter",
  weight,
  style: "normal" as const,
  data: readFileSync(join(process.cwd(), `src/components/audit/fonts/inter-latin-${weight}-normal.woff`)),
});
export const PNG_FONTS = [face(400), face(600)];

export function pngResponse(loaded: Loaded | null, free: boolean): Response {
  if (!loaded) return notFound();
  const { results } = loaded;
  return new ImageResponse(createElement(AuditImage, { ...loaded, free }), {
    width: 1200,
    height: 630,
    fonts: PNG_FONTS,
    headers: exportHeaders("png", exportFilename(results.label, results.run.finished_at, "png")),
  });
}
