"use client";
import { useId, useState } from "react";
import { connectionsCopy as hub } from "@/components/connections/copy";
import { Button } from "@/components/ui/Button";
import { gbpEditCopy as c } from "./gbp-edit-copy";
import { Select } from "@/components/ui/Select";

// v1 allowlist (lead Q3): the three text fields only. Nothing else renders.
const FIELDS = [
  ["description", c.description],
  ["website_uri", c.website],
  ["primary_phone", c.phone],
] as const;
type Field = (typeof FIELDS)[number][0];
export type GbpTextEdit = Partial<Record<Field, string>>;
export type GbpChange = { field: string; before: unknown; after: unknown };
export type GbpEditorProps = {
  locations: { id: string; name: string }[];
  preview: (location: string, edit: GbpTextEdit) => Promise<{ changes: GbpChange[] } | { error: string }>;
  apply: (
    location: string,
    edit: GbpTextEdit,
    confirmed: GbpChange[],
  ) => Promise<{ applied: number } | { error: string }>;
};

const field =
  "w-full rounded-control bg-paper px-3 text-ui text-ink ring-1 ring-inset ring-fieldBorder outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep";
const show = (v: unknown) =>
  v === null || v === undefined || v === "" ? "–" : typeof v === "string" ? v : JSON.stringify(v);

// C-c PR 2 (lead OK 2026-11-06, D2): Preview (the live diff) is the confirmation; Apply shows only after a
// non-empty diff and applies exactly it. Any edit after a preview takes Apply away until a new preview.
export function GbpEditor({ locations, preview, apply }: GbpEditorProps) {
  const id = useId();
  const [location, setLocation] = useState(locations[0]?.id ?? "");
  const [values, setValues] = useState<GbpTextEdit>({});
  const [changes, setChanges] = useState<GbpChange[] | null>(null);
  const [status, setStatus] = useState<"" | "busy" | "applied" | "failed" | "stale">("");
  const edit = (): GbpTextEdit =>
    Object.fromEntries(Object.entries(values).filter(([, v]) => v && v.trim())) as GbpTextEdit;

  const runPreview = async () => {
    const e = edit();
    if (!Object.keys(e).length) return;
    setStatus("busy");
    const r = await preview(location, e).catch(() => ({ error: "failed" }));
    if ("error" in r) return setStatus("failed");
    setChanges(r.changes);
    setStatus("");
  };

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border p-3">
      <div>
        <label htmlFor={`${id}-loc`} className="mb-1 block text-caption font-semibold">
          {c.location}
        </label>
        <Select
          wrap="w-full"
          id={`${id}-loc`}
          value={location}
          onChange={(e) => {
            setLocation(e.target.value);
            setChanges(null);
          }}
          className={`${field} h-11 md:h-9`}
        >
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </div>
      {FIELDS.map(([key, label]) => (
        <div key={key}>
          <label htmlFor={`${id}-${key}`} className="mb-1 block text-caption font-semibold">
            {label}
          </label>
          {key === "description" ? (
            <textarea
              id={`${id}-${key}`}
              rows={3}
              value={values[key] ?? ""}
              onChange={(e) => {
                setValues((v) => ({ ...v, [key]: e.target.value }));
                setChanges(null);
              }}
              className={`${field} py-2`}
            />
          ) : (
            <input
              id={`${id}-${key}`}
              type="text"
              value={values[key] ?? ""}
              onChange={(e) => {
                setValues((v) => ({ ...v, [key]: e.target.value }));
                setChanges(null);
              }}
              className={`${field} h-11 md:h-9`}
            />
          )}
        </div>
      ))}
      <div>
        <Button variant="alt" loading={status === "busy"} onClick={runPreview}>
          {c.preview}
        </Button>
      </div>
      {changes && changes.length === 0 && <p className="text-ui">{c.noChanges}</p>}
      {changes && changes.length > 0 && (
        <>
          <ul aria-label={c.preview} className="flex flex-col divide-y divide-border border-y border-border">
            {changes.map((ch) => (
              <li key={ch.field} className="flex flex-col gap-1 py-2">
                <span className="text-ui font-medium">
                  {hub.fields[ch.field as keyof typeof hub.fields] ?? ch.field}
                </span>
                <span className="text-caption break-words text-text2">
                  {c.before}: {show(ch.before)}
                </span>
                <span className="text-caption break-words">
                  {c.after}: {show(ch.after)}
                </span>
              </li>
            ))}
          </ul>
          <div>
            <Button
              onClick={async () => {
                const e = edit();
                setStatus("busy");
                const r = await apply(location, e, changes).catch(() => ({ error: "failed" }));
                if (!("error" in r)) {
                  setChanges(null);
                  setValues({});
                  return setStatus("applied");
                }
                if (r.error !== "stale") return setStatus("failed");
                // Google changed it meanwhile: a fresh preview, and the team confirms again.
                const fresh = await preview(location, e).catch(() => ({ error: "failed" }));
                if ("error" in fresh) return setStatus("failed");
                setChanges(fresh.changes);
                setStatus("stale");
              }}
            >
              {c.apply}
            </Button>
          </div>
        </>
      )}
      <p
        role="status"
        className={status === "failed" ? "text-caption text-brick" : status ? "text-caption" : "sr-only"}
      >
        {status === "applied" ? c.applied : status === "failed" ? c.failed : status === "stale" ? c.stale : ""}
      </p>
    </div>
  );
}
