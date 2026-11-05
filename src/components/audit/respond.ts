import "server-only";
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

export function pngResponse(loaded: Loaded | null, free: boolean): Response {
  if (!loaded) return notFound();
  const { results } = loaded;
  return new ImageResponse(createElement(AuditImage, { ...loaded, free }), {
    width: 1200,
    height: 630,
    headers: exportHeaders("png", exportFilename(results.label, results.run.finished_at, "png")),
  });
}
