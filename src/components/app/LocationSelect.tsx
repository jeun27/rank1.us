import { useId } from "react";
import type { SourceLocation } from "@/lib/metrics";
import { sourcesCopy as c } from "./sources-copy";

// A plain GET form, so it works without JavaScript (QA #49). The server filters on ?location=.
// The Show button submits; changing the select alone doesn't, so arrow keys never reload the page.
export function LocationSelect({
  locations,
  value,
  action = "/app/sources",
  hidden = {},
}: {
  locations: SourceLocation[];
  value: string | undefined;
  action?: string;
  hidden?: Record<string, string>;
}) {
  const id = useId();
  return (
    <form method="get" action={action} className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-caption font-semibold">
        {c.location}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        {Object.entries(hidden).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <select
          id={id}
          name="location"
          defaultValue={value ?? ""}
          className="h-11 w-full max-w-xs rounded-control border border-fieldBorder bg-white px-3 text-ui md:h-8 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep"
        >
          <option value="">{c.allLocations}</option>
          {locations.map((l) => (
            <option key={l.key} value={l.key}>
              {l.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="inline-flex h-11 items-center rounded-control border border-fieldBorder bg-raised px-3 text-ui font-medium text-ink hover:bg-overlay md:h-8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep"
        >
          {c.show}
        </button>
      </div>
    </form>
  );
}
