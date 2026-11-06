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
// n; a table carries the same numbers for screen readers. Axis labels are HTML at a fixed 10.5px (X9b).
export function VisibilityLine({ points }: { points: SeriesPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(1, points.length - 1);
  const y = (v: number | null) => PAD.t + (1 - (v ?? 0)) * (H - PAD.t - PAD.b);
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.metric.value)}`).join(" ");
  const tip = active === null ? null : points[active];
  return (
    <div className="relative">
      <div className="flex">
        <div aria-hidden className="relative w-9 shrink-0">
          {[0, 0.5, 1].map((v) => (
            <span
              key={v}
              data-axis
              className={`absolute right-2 -translate-y-1/2 ${axis}`}
              style={{ top: `${(y(v) / H) * 100}%` }}
            >
              {`${v * 100}%`}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block h-auto w-full"
            aria-hidden
            onMouseLeave={() => setActive(null)}
          >
            {[0, 0.5, 1].map((v) => (
              <line
                key={v}
                x1={PAD.l}
                x2={W - PAD.r}
                y1={y(v)}
                y2={y(v)}
                stroke="var(--color-border)"
                strokeWidth={1}
              />
            ))}
            <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" />
            {points.map((p, i) => (
              <g key={p.runId} onMouseEnter={() => setActive(i)}>
                <rect x={x(i) - 18} y={PAD.t} width={36} height={H - PAD.t - PAD.b} fill="transparent" />
                <circle
                  cx={x(i)}
                  cy={y(p.metric.value)}
                  r={active === i ? 6 : 4}
                  fill="var(--color-accent)"
                  stroke="var(--color-white)"
                  strokeWidth={2}
                />
              </g>
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
