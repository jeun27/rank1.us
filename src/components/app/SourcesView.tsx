import type { ReactNode } from "react";
import { ENGINE_LABEL } from "@/components/audit/contract";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { CATEGORY_ORDER, type Sources } from "@/lib/metrics";
import type { Category } from "@/lib/runs/categorize";
import { LocationSelect } from "./LocationSelect";
import { Measured, Page } from "./Page";
import { sourcesCopy as c } from "./sources-copy";

// Category colors (lead, v3 PR 1; supersedes Step 9 Q3 O1): dedicated per-theme series tokens, 3 solids +
// 3 stripes in both themes, validated with the dataviz script (all pairs) on the dark and light panels.
// Social and News and blogs are striped in the Reddit and YouTube hues, Other in neutral inkMuted.
export const SERIES_STYLE: Record<Category, { fill: string; texture?: boolean }> = {
  reddit: { fill: "var(--color-series1)" },
  youtube: { fill: "var(--color-series2)" },
  review_directory: { fill: "var(--color-series3)" },
  social: { fill: "var(--color-series1)", texture: true },
  news_blog: { fill: "var(--color-series2)", texture: true },
  other: { fill: "var(--color-inkMuted)", texture: true },
};
const linksText = (n: number) => `${n} ${n === 1 ? "link" : "links"}`;

function Swatch({ category }: { category: Category }) {
  const { fill, texture } = SERIES_STYLE[category];
  return (
    <svg aria-hidden viewBox="0 0 12 12" className="size-3 shrink-0 rounded-[3px]">
      <rect width="12" height="12" fill={texture ? `url(#texture-${category})` : fill} />
    </svg>
  );
}

// One shared texture definition, referenced by bars and swatches.
const Patterns = () => (
  <svg aria-hidden width="0" height="0" className="absolute">
    <defs>
      {CATEGORY_ORDER.filter((k) => SERIES_STYLE[k].texture).map((k) => (
        <pattern
          key={k}
          id={`texture-${k}`}
          width="6"
          height="6"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="6" height="6" fill="var(--color-white)" />
          <rect width="3" height="6" fill={SERIES_STYLE[k].fill} />
        </pattern>
      ))}
    </defs>
  </svg>
);

function Bar({ parts, total }: { parts: Sources["engines"][number]["byCategory"]; total: number }) {
  const shown = parts.filter((p) => p.count > 0);
  const gap = 2;
  const width = 300;
  const usable = width - gap * (shown.length - 1);
  // Segment x positions, computed up front (a 2px surface gap between fills).
  const xs = shown.map((_, i) => shown.slice(0, i).reduce((sum, p) => sum + (p.count / total) * usable + gap, 0));
  return (
    <svg aria-hidden viewBox={`0 0 ${width} 16`} preserveAspectRatio="none" className="h-4 w-full">
      {shown.map((p, i) => (
        <rect
          key={p.category}
          x={xs[i]}
          width={(p.count / total) * usable}
          height={16}
          rx={4}
          fill={SERIES_STYLE[p.category].texture ? `url(#texture-${p.category})` : SERIES_STYLE[p.category].fill}
        />
      ))}
    </svg>
  );
}

// UI.md 4b Sources: per-engine bars by category + n links, and the top domains. Counts only, no %.
export function SourcesView({
  sources,
  location,
  checkedAt = null,
  answers,
  now,
  formAction,
  formHidden,
  mentions,
}: {
  sources: Sources | null;
  location: string | undefined;
  // The /dev gallery submits the selector to itself; the app page uses the default (/app/sources).
  formAction?: string;
  formHidden?: Record<string, string>;
  // Rule 3: the latest run's check time and its ok answers (in the selected location).
  checkedAt?: string | null;
  answers?: number;
  now?: Date;
  // G7: "Lists that name your rivals but not you", first on the page (ENABLE_MENTIONS).
  mentions?: ReactNode;
}) {
  const any = sources?.engines.some((e) => e.links > 0);
  return (
    <Page title={c.title}>
      <p className="-mt-6 text-body-lg text-inkMuted">{c.subtitle}</p>
      {mentions}
      {!sources || (!any && !location) ? (
        <Card>
          <p className="text-body-lg">{c.empty}</p>
        </Card>
      ) : (
        <>
          <Measured checkedAt={checkedAt} answers={answers} now={now} />
          <Patterns />
          <LocationSelect locations={sources.locations} value={location} action={formAction} hidden={formHidden} />
          <ul aria-label={c.category} className="flex flex-wrap gap-x-4 gap-y-2 text-caption">
            {CATEGORY_ORDER.map((k) => (
              <li key={k} className="flex items-center gap-1.5">
                <Swatch category={k} />
                {c.categories[k]}
              </li>
            ))}
          </ul>
          <div className="grid gap-4 md:grid-cols-2">
            {sources.engines.map((e) => {
              const label = ENGINE_LABEL[e.engine];
              return (
                <section
                  key={e.engine}
                  aria-label={label}
                  className="flex flex-col gap-3 rounded-surface bg-white p-4 shadow-card md:p-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-ui font-semibold">{label}</h2>
                    {e.locationSupport === "exact" && (
                      <Badge tone="info" data-location-tag>
                        {c.exact}
                      </Badge>
                    )}
                    {e.locationSupport === "fallback" && (
                      <Badge tone="neutral" title={c.fallbackTip(label)} data-location-tag>
                        {c.fallback}
                      </Badge>
                    )}
                  </div>
                  {e.links ? (
                    <>
                      <p data-computed className="text-caption tabular-nums">
                        {linksText(e.links)}
                      </p>
                      <Bar parts={e.byCategory} total={e.links} />
                      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-caption text-inkMuted">
                        {e.byCategory
                          .filter((p) => p.count > 0)
                          .map((p) => (
                            <li key={p.category} className="flex items-center gap-1.5">
                              <Swatch category={p.category} />
                              <span data-computed>{`${c.categories[p.category]} ${p.count}`}</span>
                            </li>
                          ))}
                      </ul>
                    </>
                  ) : (
                    <p data-computed className="text-caption text-inkMuted">
                      {c.noLinks(label)}
                    </p>
                  )}
                </section>
              );
            })}
          </div>
          {sources.topDomains.length > 0 && (
            <Table
              caption={c.title}
              columns={[
                { key: "d", header: c.domain },
                { key: "c", header: c.category },
                { key: "l", header: c.links, numeric: true },
                { key: "e", header: c.engines },
              ]}
              rows={sources.topDomains.map((d) => ({
                d: (
                  <a
                    href={`https://${d.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center text-link underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-jellyDeep"
                  >
                    <span data-computed>{d.domain}</span>
                  </a>
                ),
                c: c.categories[d.category],
                l: <span data-computed>{d.links}</span>,
                e: <span data-computed>{d.engines.map((x) => ENGINE_LABEL[x]).join(", ")}</span>,
              }))}
            />
          )}
        </>
      )}
    </Page>
  );
}
