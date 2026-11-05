"use client";
import { useState } from "react";
import { formatPercent } from "@/components/ui/StatNumber";
import type { SeriesPoint } from "@/lib/metrics";
import { appCopy as c } from "./copy";

const W = 640;
const H = 200;
const PAD = { l: 44, r: 16, t: 12, b: 28 };
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const named = (p: SeriesPoint) => `named in ${p.metric.numerator} of ${p.metric.denominator} answers`;

// The Dashboard line (UI.md Chart: business line jellyDeep 2px; lines and bars only). One series,
// so no legend; hover or focus a point for its n; a table carries the same numbers for screen readers.
export function VisibilityLine({ points }: { points: SeriesPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(1, points.length - 1);
  const y = (v: number | null) => PAD.t + (1 - (v ?? 0)) * (H - PAD.t - PAD.b);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.metric.value)}`).join(" ");
  const tip = active === null ? null : points[active];
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden onMouseLeave={() => setActive(null)}>
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--color-border)" strokeWidth={1} />
            <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--color-inkMuted)">
              {`${v * 100}%`}
            </text>
          </g>
        ))}
        <path d={path} fill="none" stroke="var(--color-jellyDeep)" strokeWidth={2} strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={p.runId} onMouseEnter={() => setActive(i)}>
            <rect x={x(i) - 18} y={PAD.t} width={36} height={H - PAD.t - PAD.b} fill="transparent" />
            <circle
              cx={x(i)}
              cy={y(p.metric.value)}
              r={active === i ? 6 : 4}
              fill="var(--color-jellyDeep)"
              stroke="var(--color-white)"
              strokeWidth={2}
            />
          </g>
        ))}
        {[0, points.length - 1].map((i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor={i ? "end" : "start"} fontSize={11} fill="var(--color-inkMuted)">
            {day(points[i].at)}
          </text>
        ))}
      </svg>
      {tip && (
        <div
          data-computed
          className="pointer-events-none absolute top-0 rounded-card border border-border bg-white px-3 py-2 text-caption shadow-card"
          style={{ left: `min(calc(${(x(active!) / W) * 100}% + 8px), calc(100% - 12rem))` }}
        >
          <p className="font-semibold tabular-nums">{formatPercent(tip.metric)}</p>
          <p className="tabular-nums">{named(tip)}</p>
          <p className="text-inkMuted">{day(tip.at)}</p>
        </div>
      )}
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
