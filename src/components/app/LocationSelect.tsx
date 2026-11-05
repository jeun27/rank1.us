"use client";
import { useId } from "react";
import type { SourceLocation } from "@/lib/metrics";
import { sourcesCopy as c } from "./sources-copy";

// The choice lives in ?location= so the server filters the chart and the table.
export function LocationSelect({ locations, value }: { locations: SourceLocation[]; value: string | undefined }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-caption font-semibold">
        {c.location}
      </label>
      <select
        id={id}
        value={value ?? ""}
        onChange={(e) => {
          const url = new URL(window.location.href);
          if (e.target.value) url.searchParams.set("location", e.target.value);
          else url.searchParams.delete("location");
          window.location.assign(url.toString());
        }}
        className="h-12 w-full max-w-xs rounded-full border border-fieldBorder bg-white px-5 text-ui shadow-field focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep"
      >
        <option value="">{c.allLocations}</option>
        {locations.map((l) => (
          <option key={l.key} value={l.key}>
            {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
