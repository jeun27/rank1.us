import { useEffect, useId, useState } from "react";
import { buildQuestions, type Business, type Picks } from "@/lib/questions/templates";
import { card as c } from "./copy";

// Edits settle for 250 ms before the preview rebuilds (README §10 motion), then the rows fade in.
function useSettled<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  const key = JSON.stringify(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ms]);
  return v;
}

// UI3 (Q7): the first questions Rank1 will ask, built from the card with the same templates as step 4.
// md+: the right-hand panel. Phones: one line above the card (OC3).
export function QuestionPreview({
  business,
  picks,
  phone = false,
}: {
  business: Business;
  picks: Picks;
  phone?: boolean;
}) {
  const settled = useSettled({ business, picks });
  const titleId = useId();
  const all = buildQuestions(settled.business, settled.picks);
  const first = all.slice(0, 3);
  if (phone)
    return all.length > 0 ? (
      <p data-phone-preview className="text-caption text-text2">
        {c.phonePreview(all[0].short_text, all.length - 1)}
      </p>
    ) : null;
  return (
    <>
      {/* A labelled group, not a landmark: it previews the card beside it. */}
      <div
        role="group"
        aria-labelledby={titleId}
        className="self-start rounded-surface border border-border bg-white p-4 md:p-5"
      >
        <div className="flex items-baseline justify-between gap-3">
          {/* Not a heading: the step's one heading is its H1 (OB2). */}
          <p id={titleId} className="text-ui font-medium text-ink">
            {c.preview}
          </p>
          {all.length > 0 && (
            <span className="font-mono text-caption text-inkMuted tabular-nums">
              {c.shown(first.length, all.length)}
            </span>
          )}
        </div>
        <p className="mt-1 text-caption text-text2">{c.previewHint}</p>
        <ul className="mt-2">
          {first.map((q) => (
            <li
              key={q.short_text}
              data-computed
              className="animate-fade-in border-b border-border py-2.5 text-ui text-ink"
            >
              {q.short_text}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-caption text-text2">{c.previewLater}</p>
      </div>
    </>
  );
}
