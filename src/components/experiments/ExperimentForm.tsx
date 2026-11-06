"use client";
import { useId, useState } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { experimentCopy as c } from "./copy";

export type NewTest = {
  name: string;
  changeNote: string | null;
  changeUrl: string | null;
  changeDate: string;
  test: string[];
  control: string[];
  fixId: string | null;
};
type Errors = Partial<Record<"test" | "control" | "link", string>>;

const field =
  "h-11 w-full rounded-control border border-fieldBorder bg-white px-3 text-ui md:h-9 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep";
const HTTP = /^https?:\/\/\S+$/i;

// 'Start a test' (Step 17, X22): step 1 is the test questions. Control is every other question, shown as
// "the other n questions" with Edit to drop some, so the two groups can't overlap. Start lights up at 1+
// test question and a name, with the reason until then. create_experiment checks the same rules again.
export function ExperimentForm({
  questions,
  today,
  fix = null,
  onCreate,
}: {
  questions: { id: string; text: string }[];
  // YYYY-MM-DD in America/Los_Angeles; also the latest allowed change date.
  today: string;
  fix?: { id: string; title: string } | null;
  onCreate: (t: NewTest) => Promise<{ error: string } | undefined | void>;
}) {
  const id = useId();
  const [test, setTest] = useState<Set<string>>(new Set());
  // Questions taken out of control by hand (Edit). Control is derived, so it never holds a test question.
  const [dropped, setDropped] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(fix?.title ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  // Pressed before it's ready: the polite region says the reason (cleared first so a repeat is heard).
  const [said, setSaid] = useState("");
  const nudge = () => {
    setSaid("");
    setTimeout(() => setSaid(c.startReason));
  };
  const control = new Set(questions.filter((q) => !test.has(q.id) && !dropped.has(q.id)).map((q) => q.id));
  const ready = test.size > 0 && name.trim() !== "";

  const flip = (s: Set<string>, qid: string) => {
    const next = new Set(s);
    if (!next.delete(qid)) next.add(qid);
    return next;
  };
  const ordered = (s: Set<string>) => questions.filter((q) => s.has(q.id)).map((q) => q.id);

  const group = (kind: "test" | "control", legend: string, list: { id: string; text: string }[]) => (
    <fieldset
      id={`${id}-${kind}-group`}
      className="flex flex-col gap-2"
      aria-describedby={errors[kind] ? `${id}-${kind}` : undefined}
    >
      <legend className="mb-1 text-caption font-semibold">{legend}</legend>
      <ul className="flex flex-col divide-y divide-border rounded-card border border-border">
        {list.map((q) => (
          <li key={q.id}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 text-ui md:min-h-9">
              <input
                type="checkbox"
                checked={(kind === "test" ? test : control).has(q.id)}
                onChange={() => (kind === "test" ? setTest(flip(test, q.id)) : setDropped(flip(dropped, q.id)))}
                className="size-4 shrink-0 accent-[var(--color-accent)]"
              />
              <span data-computed>{q.text}</span>
            </label>
          </li>
        ))}
      </ul>
      {errors[kind] && (
        <p id={`${id}-${kind}`} className="text-caption text-brick">
          {errors[kind]}
        </p>
      )}
    </fieldset>
  );

  return (
    <form
      noValidate
      className="flex max-w-2xl flex-col gap-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ready) return nudge();
        const data = new FormData(e.currentTarget);
        const link = String(data.get("change_url") ?? "").trim();
        const next: Errors = {};
        if (!control.size) next.control = c.errors.control;
        if (link && !HTTP.test(link)) next.link = c.errors.link;
        setErrors(next);
        setFailed(false);
        if (Object.keys(next).length) return;
        setSaving(true);
        const r = await onCreate({
          name: name.trim(),
          changeNote: String(data.get("change_note") ?? "").trim() || null,
          changeUrl: link || null,
          changeDate: String(data.get("change_date") || today),
          test: ordered(test),
          control: ordered(control),
          fixId: fix?.id ?? null,
        }).catch(() => ({ error: "failed" }));
        setSaving(false);
        if (r && "error" in r) setFailed(true);
      }}
    >
      {failed && <Banner tone="error">{c.saveFailed}</Banner>}
      {group("test", c.testQuestions, questions)}
      <div className="flex flex-col gap-3">
        <p className="flex flex-wrap items-center gap-x-3 text-ui">
          {control.size > 0 && <span data-computed>{c.controlLine(control.size)}</span>}
          <button
            type="button"
            aria-expanded={editing}
            aria-controls={`${id}-control-group`}
            onClick={() => setEditing(!editing)}
            className="inline-flex min-h-11 items-center text-link underline underline-offset-4 md:min-h-8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep"
          >
            {c.edit}
          </button>
        </p>
        {editing &&
          group(
            "control",
            c.controlQuestions,
            questions.filter((q) => !test.has(q.id)),
          )}
        {/* Edit closed: the control error still needs a place to show. */}
        {!editing && errors.control && (
          <p id={`${id}-control`} className="text-caption text-brick">
            {errors.control}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-name`} className="text-caption font-semibold">
          {c.name}
        </label>
        <input
          id={`${id}-name`}
          name="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={field}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-note`} className="text-caption font-semibold">
          {c.whatChanged}
        </label>
        <textarea
          id={`${id}-note`}
          name="change_note"
          rows={3}
          className="w-full rounded-control border border-fieldBorder bg-white px-3 py-2 text-ui focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-jellyDeep"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-link`} className="text-caption font-semibold">
          {c.link}
        </label>
        <input
          id={`${id}-link`}
          name="change_url"
          type="url"
          inputMode="url"
          aria-invalid={errors.link ? true : undefined}
          aria-describedby={errors.link ? `${id}-link-error` : undefined}
          className={field}
        />
        {errors.link && (
          <p id={`${id}-link-error`} className="text-caption text-brick">
            {errors.link}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-date`} className="text-caption font-semibold">
          {c.changeDate}
        </label>
        <input
          id={`${id}-date`}
          name="change_date"
          type="date"
          defaultValue={today}
          max={today}
          className={`${field} max-w-48`}
        />
      </div>
      <div className="flex flex-col gap-2">
        <div>
          {/* Founder rule: never a silent disabled button. aria-disabled keeps it focusable; the form's
              submit handler stops it and says why. */}
          <Button
            type="submit"
            loading={saving}
            aria-disabled={!ready || undefined}
            aria-describedby={ready ? undefined : `${id}-reason`}
            className="aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
          >
            {c.start}
          </Button>
        </div>
        {!ready && (
          <p id={`${id}-reason`} className="text-caption text-inkMuted">
            {c.startReason}
          </p>
        )}
        <span role="status" className="sr-only">
          {ready ? "" : said}
        </span>
      </div>
    </form>
  );
}
