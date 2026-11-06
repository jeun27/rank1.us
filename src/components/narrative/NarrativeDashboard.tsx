import Link from "next/link";
import { useId } from "react";
import type { NarrativeView } from "@/lib/narrative/service";
import { narrativeCopy as c } from "./copy";

const HREF = "/app/settings/narrative";
const link = "text-ui text-link underline underline-offset-4";

// G4 on the /app Dashboard (lead Q2, "show the next step only when it's relevant"): the card for a clash,
// one quiet line when there are no words yet, and nothing otherwise (no clash and too few live in Settings).
export function NarrativeDashboard({ view }: { view: NarrativeView }) {
  const heading = useId();
  const { words, result } = view;
  if (!words.want.length && !words.avoid.length)
    return (
      <p className="text-caption text-inkMuted">
        {c.noWords}{" "}
        <Link href={HREF} className="text-caption text-link underline underline-offset-4">
          {c.addWords}
        </Link>
      </p>
    );
  if (!result || result.tooFew || result.clashes === 0) return null;
  const hit = result.avoid.filter((w) => w.answers > 0).map((w) => w.word);
  const s = result.snippet;
  return (
    <section
      aria-labelledby={heading}
      className="flex flex-col gap-3 rounded-card border border-border bg-white p-4 md:p-5"
    >
      <h2 id={heading} className="heading-gradient font-display text-section font-medium">
        {c.title}
      </h2>
      <p data-computed className="text-ui font-medium">
        {c.clash(result.clashes, result.n, hit)}
      </p>
      {s && (
        <figure className="flex flex-col gap-1">
          <blockquote data-computed className="border-l-2 border-border pl-3 text-ui text-text2">
            {s.text.slice(0, s.start)}
            <mark className="rounded-tag bg-warnBg px-0.5 text-warnText">{s.text.slice(s.start, s.end)}</mark>
            {s.text.slice(s.end)}
          </blockquote>
          <figcaption className="text-caption text-inkMuted">{c.wordMatch}</figcaption>
        </figure>
      )}
      <Link href={HREF} className={`self-start ${link}`}>
        {c.edit}
      </Link>
    </section>
  );
}
