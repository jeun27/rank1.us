"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { YoutubeChecklist } from "@/lib/connections/service";
import { youtubeCopy as c } from "./copy";

type Video = YoutubeChecklist["videos"][number];
type Cell = "pass" | "fail" | "no_keyword" | "not_needed" | "cant_check";

const REAUTH = new Set(["needs_reauth", "revoked", "not_connected"]);
const action =
  "inline-flex min-h-11 items-center text-caption text-link underline underline-offset-4 md:min-h-8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep";

const safeHref = (url: string) => {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:" ? url : null;
  } catch {
    return null;
  }
};

// Text plus tone, never colour alone.
function Value({ v }: { v: Cell }) {
  const [tone, label] = {
    pass: ["success", c.yes],
    fail: ["error", c.no],
    no_keyword: ["neutral", c.noKeywordCell],
    not_needed: ["neutral", c.notNeeded],
    cant_check: ["neutral", c.cantCheck],
  }[v] as ["success" | "error" | "neutral", string];
  return <Badge tone={tone}>{label}</Badge>;
}

function CopyRow({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <li className="flex flex-wrap items-center justify-between gap-2">
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
    </li>
  );
}

function VideoItem({ v, keyword, business }: { v: Video; keyword: string | null; business: string }) {
  const [open, setOpen] = useState(false);
  const href = safeHref(v.url);
  const { checks } = v;
  // The chapters template needs no keyword; the title and description ones do.
  const templates = [
    keyword && checks.title === "fail" && c.titleTemplate(keyword, v.title),
    keyword &&
      checks.description === "fail" &&
      c.lineTemplate(keyword, business, v.description.split(/\r?\n/)[0] ?? ""),
    checks.chapters === "fail" && c.chaptersTemplate,
  ].filter((t): t is string => Boolean(t));
  const rows: [string, Cell][] = [
    [c.titleCheck, checks.title],
    [c.descriptionCheck, checks.description],
    [c.chaptersCheck, checks.chapters],
    [c.saysCheck, checks.saysKeyword],
  ];
  return (
    <li data-video={v.id} className="flex flex-col gap-2 py-3">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ui font-medium text-link underline underline-offset-4"
        >
          {v.title} <span className="sr-only">{c.newTab}</span>
        </a>
      ) : (
        <span className="text-ui font-medium">{v.title}</span>
      )}
      <ul className="flex flex-col gap-1">
        {rows.map(([label, value]) => (
          <li key={label} className="flex items-center justify-between gap-2 text-caption">
            <span>{label}</span>
            <Value v={value} />
          </li>
        ))}
      </ul>
      {templates.length > 0 && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={`self-start ${action}`}
        >
          {c.suggest}
        </button>
      )}
      {open && (
        <div className="flex flex-col gap-2 rounded-card border border-border p-3">
          <ul className="flex flex-col gap-2">
            {templates.map((t) => (
              <CopyRow key={t} text={t} />
            ))}
          </ul>
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

// G1 (lead OK 2026-11-06): the Search-ready checklist, the evidence inside the P4 fixes R19–R21. Read-only:
// the checks come from the live YouTube read (data-pipeline's loadYoutubeChecklist), or its failure code.
export function YoutubeChecklistPanel({
  checklist,
  business,
}: {
  checklist: YoutubeChecklist | string;
  business: string;
}) {
  const heading = useId();
  return (
    <section aria-labelledby={heading} className="flex flex-col gap-2">
      <h4 id={heading} className="text-ui font-semibold">
        {c.title}
      </h4>
      {typeof checklist === "string" ? (
        REAUTH.has(checklist) ? (
          <Link href="/app/settings/connections" className={`self-start ${action}`}>
            {c.reconnect}
          </Link>
        ) : (
          <p className="text-ui">{c.loadFailed}</p>
        )
      ) : !checklist.channel ? (
        <p className="text-ui">{c.noChannel}</p>
      ) : (
        <>
          <p data-computed className="text-caption text-inkMuted">
            {checklist.keyword ? `${c.keyword(checklist.keyword)} · ` : ""}
            {c.videos(checklist.videos.length)}
          </p>
          {/* No keyword (lead): the plain line alone, never a list of "No keyword" cells. */}
          {!checklist.keyword ? (
            <p className="text-ui">{c.noKeyword}</p>
          ) : checklist.videos.length === 0 ? (
            <p className="text-ui">{c.noVideos}</p>
          ) : (
            <>
              <ul className="flex flex-col divide-y divide-border border-y border-border">
                {checklist.videos.map((v) => (
                  <VideoItem key={v.id} v={v} keyword={checklist.keyword} business={business} />
                ))}
              </ul>
              <p className="text-caption text-inkMuted">
                {c.saysCheck}: {c.cantReason}
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
