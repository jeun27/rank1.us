"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { safeHref } from "@/components/mentions/MentionsSection";
import { Button } from "@/components/ui/Button";
import { linkTarget } from "@/components/ui/link";
import { youtubeCopy as c } from "./copy";

type Rule = "R19" | "R20" | "R21";
type FixVideo = { id: string; title: string; url: string };

const action =
  "inline-flex min-h-11 items-center text-caption text-link underline underline-offset-4 md:min-h-8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep";

function Template({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <code className="font-mono text-caption break-words">{text}</code>
      <button
        type="button"
        className={action}
        onClick={async () => {
          await navigator.clipboard?.writeText(text).catch(() => undefined);
          setDone(true);
        }}
      >
        {done ? c.copied : c.copy}
      </button>
    </div>
  );
}

// The template for this fix's one check: R19 the title, R20 the description's opening, R21 chapters.
const templateFor = (rule: Rule, v: FixVideo, keyword: string | null, business: string) =>
  rule === "R21"
    ? c.chaptersTemplate
    : !keyword
      ? null
      : rule === "R19"
        ? c.titleTemplate(keyword, v.title)
        : c.lineTemplate(keyword, business);

function Item({ rule, v, keyword, business }: { rule: Rule; v: FixVideo; keyword: string | null; business: string }) {
  const [open, setOpen] = useState(false);
  const href = safeHref(v.url);
  const template = templateFor(rule, v, keyword, business);
  return (
    <li data-video={v.id} className="flex flex-col gap-2 py-2">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`${linkTarget} self-start text-ui font-medium text-link underline underline-offset-4`}
        >
          {/* One flex item, so the space before the screen-reader suffix stays in the name. */}
          <span>
            {v.title} <span className="sr-only">{c.newTab}</span>
          </span>
        </a>
      ) : (
        <span className="text-ui font-medium">{v.title}</span>
      )}
      {template && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={`self-start ${action}`}
        >
          {c.suggest}
        </button>
      )}
      {open && template && (
        <div className="flex flex-col gap-2 rounded-card border border-border p-3">
          <Template text={template} />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="alt" disabled>
              {c.apply}
            </Button>
            <Badge tone="info">{c.comingSoon}</Badge>
          </div>
        </div>
      )}
    </li>
  );
}

// G1 (#150 review): a YouTube fix's evidence is its own failing videos, as the weekly pass stored them. No live
// YouTube read; no full checklist repeated per fix. The captions line sits under R19 only.
export function YoutubeFixEvidence({
  rule,
  videos,
  keyword,
  business,
}: {
  rule: Rule;
  videos: FixVideo[];
  keyword: string | null;
  business: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {keyword && (
        <p data-computed className="text-caption text-inkMuted">
          {c.keyword(keyword)}
        </p>
      )}
      <ul className="flex flex-col divide-y divide-border">
        {videos.map((v) => (
          <Item key={v.id} rule={rule} v={v} keyword={keyword} business={business} />
        ))}
      </ul>
      {rule === "R19" && <p className="text-caption text-inkMuted">{c.saysLine}</p>}
    </div>
  );
}
