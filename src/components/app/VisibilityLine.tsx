"use client";
import { useState } from "react";
import { formatPercent } from "@/components/ui/StatNumber";
import type { SeriesPoint } from "@/lib/metrics";
import { appCopy as c } from "./copy";

const W = 640;
const H = 200;
const PAD = { l: 8, r: 8, t: 8, b: 8 };
const axis = "font-mono text-[10.5px] leading-none text-inkMuted tabular-nums";
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const named = (p: SeriesPoint) => `named in ${p.metric.numerator} of ${p.metric.denominator} answers`;

// The Dashboard line (UI.md Chart: lines and bars only). One series, so no legend; hover a point for its
// n; a table carries the same numbers for screen readers. Labels and dots are HTML, so the fixed-height
// SVG can stretch without shrinking text (X9b) or squashing dots. The axis runs from 0 to the smallest
// 20-point step that holds the highest point (DQ5).
export function VisibilityLine({ points }: { points: SeriesPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(1, points.length - 1);
  const high = Math.max(0, ...points.map((p) => p.metric.value ?? 0));
  const top = Math.min(1, Math.max(0.2, Math.ceil(high * 5 - 1e-9) / 5));
  const y = (v: number | null) => PAD.t + (1 - (v ?? 0) / top) * (H - PAD.t - PAD.b);
  const left = (i: number) => `${(x(i) / W) * 100}%`;
  const down = (v: number | null) => `${(y(v) / H) * 100}%`;
  const last = points.at(-1);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.metric.value)}`).join(" ");
  const tip = active === null ? null : points[active];
  return (
    <div className="relative">
      <div className="flex">
        <div aria-hidden className="relative w-9 shrink-0">
          {[0, top / 2, top].map((v) => (
            <span key={v} data-axis className={`absolute right-2 -translate-y-1/2 ${axis}`} style={{ top: down(v) }}>
              {`${Math.round(v * 100)}%`}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="block h-40 w-full md:h-50"
            aria-hidden
            onMouseLeave={() => setActive(null)}
          >
            {[0, top / 2, top].map((v) => (
              <line
                key={v}
                x1={PAD.l}
                x2={W - PAD.r}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--color-border)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <path
              d={path}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={2}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {points.map((p, i) => (
              <g key={p.runId} onMouseEnter={() => setActive(i)}>
                <rect x={x(i) - 18} y={PAD.t} width={36} height={H - PAD.t - PAD.b} fill="transparent" />
              </g>
            ))}
          </svg>
          {points.map((p, i) => (
            <span
              key={p.runId}
              aria-hidden
              className={`pointer-events-none absolute -translate-1/2 rounded-full bg-accent ring-2 ring-white ${active === i ? "size-2.5" : "size-1.5"}`}
              style={{ left: left(i), top: down(p.metric.value) }}
            />
          ))}
          {last && (
            <span
              aria-hidden
              data-end-label
              className="pointer-events-none absolute right-0 -translate-y-[calc(100%+6px)] font-mono text-caption font-medium text-ink tabular-nums"
              style={{ top: down(last.metric.value) }}
            >
              {formatPercent(last.metric)}
            </span>
          )}
          {tip && (
            <div
              data-computed
              className="pointer-events-none absolute top-0 rounded-card border border-border bg-white px-3 py-2 text-caption shadow-card"
              style={{ left: `min(calc(${left(active!)} + 8px), calc(100% - 12rem))` }}
            >
              <p className="font-semibold tabular-nums">{formatPercent(tip.metric)}</p>
              <p className="tabular-nums">{named(tip)}</p>
              <p className="text-inkMuted">{day(tip.at)}</p>
            </div>
          )}
        </div>
      </div>
      <div aria-hidden className="mt-1.5 ml-9 flex justify-between" style={{ paddingInline: `${(PAD.l / W) * 100}%` }}>
        {[0, points.length - 1].map((i) => (
          <span key={i} data-axis className={axis}>
            {day(points[i].at)}
          </span>
        ))}
      </div>
      {/* A table ignores sr-only's 1px width, so the wrapper is the one that is clipped. */}
      <div className="sr-only">
        <table>
          <caption>{c.visibility}</caption>
          <thead>
            <tr>
              <th scope="col">{c.checked}</th>
              <th scope="col">{c.visibility}</th>
              <th scope="col">{c.named}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.runId}>
                <td>{day(p.at)}</td>
                <td>{formatPercent(p.metric)}</td>
                <td>{named(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
