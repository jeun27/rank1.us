"use client";

import { startTransition, useActionState, useId } from "react";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { adminCopy as c, missingKeysText } from "@/lib/admin/copy";
import type { EngineTestResult } from "@/app/admin/test/actions";
import { Select } from "@/components/ui/Select";

const field =
  "block w-full rounded-control border border-fieldBorder bg-white px-4 py-2.5 text-ui text-ink focus-visible:outline-2 focus-visible:outline-jellyDeep";

type Props = {
  missing: readonly string[];
  action: (prev: EngineTestResult, form: FormData) => Promise<EngineTestResult>;
};

export function EngineTestForm({ missing, action }: Props) {
  const [result, submit, pending] = useActionState(action, null);
  const id = useId();
  return (
    <div className="flex flex-col gap-6">
      {missing.length > 0 && <Banner tone="info">{missingKeysText(missing)}</Banner>}
      <form
        // onSubmit, not action=: React resets a form after its action, and the fields must match the result.
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          startTransition(() => submit(data));
        }}
        className="flex flex-col gap-4"
      >
        <div>
          <label htmlFor={`${id}-engine`} className="mb-1.5 block text-caption font-semibold">
            {c.engineLabel}
          </label>
          <Select wrap="w-full" id={`${id}-engine`} name="engine" className={field} defaultValue="chatgpt">
            {Object.entries(c.engines).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor={`${id}-question`} className="mb-1.5 block text-caption font-semibold">
            {c.questionLabel}
          </label>
          <input id={`${id}-question`} name="question" required maxLength={500} className={field} />
        </div>
        <div>
          <label htmlFor={`${id}-level`} className="mb-1.5 block text-caption font-semibold">
            {c.levelLabel}
          </label>
          <Select wrap="w-full" id={`${id}-level`} name="level" className={field} defaultValue="city">
            {Object.entries(c.levels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" loading={pending} disabled={missing.length > 0} className="self-start">
          {pending ? c.running : c.run}
        </Button>
      </form>
      {result && !("invalid" in result) && <Result answer={result} />}
    </div>
  );
}

function Result({ answer: a }: { answer: Exclude<EngineTestResult, null | { invalid: true }> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-[10rem_1fr]" aria-live="polite">
      <dt className="font-semibold">{c.status}</dt>
      <dd>
        {a.status}
        {a.error ? `: ${a.error}` : ""}
      </dd>
      <dt className="font-semibold">{c.answer}</dt>
      <dd className="whitespace-pre-wrap break-words">{a.text ?? "–"}</dd>
      <dt className="font-semibold">{c.citations}</dt>
      <dd>
        {a.citations.length === 0 ? (
          "–"
        ) : (
          <ol className="list-decimal pl-5">
            {a.citations.map((l) => (
              <li key={l.position} className="break-all">
                <a
                  href={l.url}
                  rel="noreferrer noopener"
                  target="_blank"
                  className="text-link underline underline-offset-4"
                >
                  {l.title ?? l.url}
                </a>{" "}
                ({l.domain})
              </li>
            ))}
          </ol>
        )}
      </dd>
      <dt className="font-semibold">{c.location}</dt>
      <dd>
        {a.locationSupported === "exact" ? c.exact : c.fallback} · {a.locationUsed}
      </dd>
      <dt className="font-semibold">{c.cost}</dt>
      <dd className="tabular-nums">{a.costUsd ?? "–"}</dd>
    </dl>
  );
}
