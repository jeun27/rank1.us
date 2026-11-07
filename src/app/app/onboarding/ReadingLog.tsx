import { useId } from "react";
import { Icon } from "@/components/ui/Icon";
import type { SiteProfile, SiteServices } from "./contract";
import { reading as r } from "./copy";

// The words for "Found {fields} in schema.org", in card order.
const FIELDS: [keyof SiteProfile["sources"], string][] = [
  ["name", "name"],
  ["vertical", "type"],
  ["category", "type"],
  ["cuisine", "cuisine"],
  ["address", "address"],
  ["phone", "phone"],
  ["city", "city"],
  ["areaServed", "area"],
];

// UI2 (O1, README §10): the live reading log in the right panel. A stage ticks only when its server action
// really finishes (readHome = stages 1–3, readServices = 4); the next row appears when it's reached.
export function ReadingLog({
  domain,
  home,
  services,
}: {
  domain: string;
  home: SiteProfile | null;
  services: SiteServices | null;
}) {
  const titleId = useId();
  const sources = home?.sources ?? {};
  const schema = [...new Set(FIELDS.filter(([k]) => sources[k] === "schema").map(([, w]) => w))];
  const inHead = Object.values(sources).some((s) => s === "meta" || s === "title");
  const done = (home ? 3 : 0) + (services ? 1 : 0);
  return (
    // A labelled group, not a landmark: it reports progress on the task beside it.
    <div
      role="group"
      aria-labelledby={titleId}
      className="self-start rounded-surface border border-border bg-white p-4 animate-fade-in md:p-5"
    >
      <div className="flex items-baseline justify-between gap-3 border-b border-border pb-3">
        {/* Not a heading: step 1 keeps the page's one H1 (OB2). */}
        <p id={titleId} className="min-w-0 truncate text-ui font-medium text-ink">
          {r.title(domain)}
        </p>
        <span className="font-mono text-caption text-inkMuted tabular-nums">{r.count(done)}</span>
      </div>
      <ul aria-live="polite" className="flex flex-col">
        {!home && (
          <li aria-hidden className="flex items-center gap-3 py-3">
            <Spinner />
          </li>
        )}
        {home && (
          <>
            <Stage title={r.opened(domain)} />
            <Stage title={r.details} line={schema.length ? r.foundSchema(schema.join(", ")) : r.notOnSite} />
            <Stage title={r.head} line={inHead ? r.foundHead : r.notOnSite} />
            <Stage
              title={r.services}
              pending={!services}
              line={
                !services
                  ? r.readingServices
                  : services.services.length
                    ? r.servicesFound(services.services.length)
                    : r.notOnSite
              }
            />
          </>
        )}
      </ul>
      <p className="mt-3 text-caption text-inkMuted">{r.note}</p>
    </div>
  );
}

function Stage({ title, line, pending = false }: { title: string; line?: string; pending?: boolean }) {
  return (
    <li className="flex gap-3 border-b border-border py-3 animate-fade-in">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center">
        {pending ? <Spinner /> : <Icon name="check" className="size-4 text-moss" />}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className={`text-ui font-medium ${pending ? "text-text2" : "text-ink"}`}>{title}</span>
        {line && <span className="text-caption text-text2">{line}</span>}
      </span>
    </li>
  );
}

// OC5: a ringless arc, not a "C" in a ring. Reduced motion: a static dot instead.
function Spinner() {
  return (
    <span data-stage-spinner data-testid="stage-spinner" className="inline-flex size-4 items-center justify-center">
      <svg viewBox="0 0 16 16" aria-hidden className="size-4 animate-spin text-accent motion-reduce:hidden">
        <path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span data-static-dot className="hidden size-1.5 rounded-full bg-inkMuted motion-reduce:block" />
    </span>
  );
}
