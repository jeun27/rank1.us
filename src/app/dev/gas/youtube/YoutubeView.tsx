"use client";
import { useState } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import type { Query } from "../params";
import { EditFlow } from "../EditFlow";
import { Blocks, Checked, Note, Panel, PillarTag, Proto, Status, Tag } from "../ui";

const STATES = [
  { key: "tile-saas", label: "Tile: Recommended" },
  { key: "tile-restaurant", label: "Tile: Optional" },
  { key: "connecting", label: "Connecting" },
  { key: "connect-error", label: "Connect error" },
  { key: "checklist", label: "Checklist" },
  { key: "partial", label: "Checklist: captions off" },
  { key: "empty", label: "No videos" },
  { key: "loading", label: "Loading" },
  { key: "suggest", label: "Suggest fix (v1)" },
  { key: "suggest-v2", label: "Suggest fix (later, Q4 alt)" },
];

type Check = "yes" | "no" | "na";
type Video = { id: string; title: string; keyword: string; checks: [Check, Check, Check, Check] };
const CHECKS = ["Keyword in title", "Keyword in the first lines", "Chapters", "Says the keyword"];

const VIDEOS: Video[] = [
  { id: "v1", title: "Our story", keyword: "tonkotsu ramen irvine", checks: ["no", "no", "no", "yes"] },
  {
    id: "v2",
    title: "Vegan miso ramen, made from scratch",
    keyword: "vegan ramen irvine",
    checks: ["yes", "no", "yes", "yes"],
  },
  {
    id: "v3",
    title: "Tonkotsu ramen in Irvine: our 18-hour broth",
    keyword: "tonkotsu ramen irvine",
    checks: ["yes", "yes", "yes", "yes"],
  },
];

const SUGGESTED = {
  title: "Tonkotsu ramen in Irvine: our story",
  description:
    "Tonkotsu ramen in Irvine, made at Diamond Jamboree since 2019.\n\n00:00 Intro\n01:10 The 18-hour broth\n03:40 Hand-pulled noodles",
};

export function YoutubeView({ q }: { q: Query }) {
  const state = STATES.some((s) => s.key === q.state) ? q.state! : "tile-saas";
  return (
    <Proto
      title="YouTube"
      intro="G1. Connect the channel with Google's own sign-in (read-only, Q4), then every video gets a search-ready checklist from what YouTube already stores: the title, description, chapters and captions. Suggestions are fill-in templates from the business's tracked questions, not AI-written."
      states={STATES}
      state={state}
    >
      <Body state={state} />
    </Proto>
  );
}

function Body({ state }: { state: string }) {
  if (state === "tile-saas" || state === "tile-restaurant") return <Tiles recommended={state === "tile-saas"} />;
  if (state === "connecting")
    return (
      <Panel title="YouTube">
        <Button loading>Opening Google…</Button>
      </Panel>
    );
  if (state === "connect-error")
    return (
      <Panel title="YouTube">
        <Banner tone="error" action={{ label: "Try again", onClick: () => {} }}>
          Google didn&apos;t give access. Try again and tick the YouTube box.
        </Banner>
      </Panel>
    );
  if (state === "loading") return <Blocks label="Loading videos" n={3} />;
  if (state === "empty")
    return (
      <Panel title="Search-ready checklist">
        <p className="text-ui">No videos on this channel yet. A 2-minute tour of your best dish is a good first one.</p>
      </Panel>
    );
  return (
    <Checklist
      captions={state !== "partial"}
      open={state.startsWith("suggest") ? "v1" : null}
      v2={state === "suggest-v2"}
    />
  );
}

function Tiles({ recommended }: { recommended: boolean }) {
  const tile = (
    <li className="flex flex-col gap-2 rounded-card border border-border bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-medium">YouTube</h3>
        <Tag tone="neutral">Read-only</Tag>
      </div>
      <p className="text-caption text-text2">For businesses that post videos.</p>
      <p className="text-caption text-inkMuted">
        Checks each video&apos;s title, description and chapters. Changes nothing.
      </p>
      <div className="mt-auto">
        <Button variant={recommended ? "primary" : "alt"}>Connect YouTube</Button>
      </div>
    </li>
  );
  const connected = (name: string, niche: string) => (
    <li className="flex flex-col gap-2 rounded-card border border-border bg-white p-3">
      <h3 className="text-[13px] font-medium">{name}</h3>
      <p className="text-caption text-text2">{niche}</p>
      <div className="mt-auto">
        <Status tone="success">Connected</Status>
      </div>
    </li>
  );
  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="rec-h" className="flex flex-col gap-2">
        <h2 id="rec-h" className="text-[13px] font-medium text-text2">
          Recommended {recommended ? "for software" : "for restaurants"}
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {recommended ? (
            <>
              {connected("Search Console", "For businesses with their own website.")}
              {tile}
            </>
          ) : (
            connected("Google Business Profile", "For businesses people find on a map.")
          )}
        </ul>
      </section>
      {!recommended && (
        <section aria-labelledby="opt-h" className="flex flex-col gap-2">
          <h2 id="opt-h" className="text-[13px] font-medium text-text2">
            Optional
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{tile}</ul>
        </section>
      )}
      <Note>
        Q3: Recommended for software and online stores (saas, dtc), Optional for everyone else. Switch the state above
        to compare. Needs Google to approve the YouTube read-only scope before it goes live.
      </Note>
    </div>
  );
}

function Mark({ c }: { c: Check }) {
  if (c === "yes") return <Status tone="success">Yes</Status>;
  if (c === "no") return <Status tone="error">No</Status>;
  return <Status tone="muted">Can&apos;t check</Status>;
}

function Checklist({ captions, open: initial, v2 }: { captions: boolean; open: string | null; v2: boolean }) {
  const [open, setOpen] = useState<string | null>(initial);
  const [copied, setCopied] = useState(false);
  const videos = captions
    ? VIDEOS
    : VIDEOS.map((v) => ({ ...v, checks: [v.checks[0], v.checks[1], v.checks[2], "na"] as Video["checks"] }));
  const score = (v: Video) => v.checks.filter((c) => c === "yes").length;
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Search-ready checklist" aside={<Checked>Checked 2 h ago · 3 videos</Checked>}>
        {!captions && (
          <p className="rounded-card border border-warnText/25 bg-warnBg px-3 py-2 text-caption text-warnText">
            Captions are off, so we can&apos;t check if you say the keyword. Turn on automatic captions in YouTube
            Studio.
          </p>
        )}
        <div className="max-h-[28rem] overflow-auto rounded-card border border-border">
          <table className="w-full min-w-[44rem] border-collapse text-caption">
            <caption className="sr-only">Search-ready checklist per video</caption>
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="text-left text-inkMuted">
                <th scope="col" className="border-b border-border px-3 py-2 font-medium">
                  Video
                </th>
                {CHECKS.map((c) => (
                  <th key={c} scope="col" className="border-b border-border px-3 py-2 font-medium">
                    {c}
                  </th>
                ))}
                <th scope="col" className="border-b border-border px-3 py-2 text-right font-medium">
                  Ready
                </th>
                <th scope="col" className="border-b border-border px-3 py-2 font-medium">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {videos.map((v) => (
                <tr key={v.id} className={open === v.id ? "bg-raised" : "hover:bg-ink/[0.04]"}>
                  <th scope="row" className="border-b border-border px-3 py-2.5 text-left font-normal">
                    <span className="block font-medium">{v.title}</span>
                    <span className="font-mono text-inkMuted">{v.keyword}</span>
                  </th>
                  {v.checks.map((c, i) => (
                    <td key={i} className="border-b border-border px-3 py-2.5">
                      <Mark c={c} />
                    </td>
                  ))}
                  <td className="border-b border-border px-3 py-2.5 text-right font-mono tabular-nums">{`${score(v)}/4`}</td>
                  <td className="border-b border-border px-3 py-2.5">
                    {score(v) < 4 && (
                      <Button
                        variant="alt"
                        aria-expanded={open === v.id}
                        onClick={() => setOpen(open === v.id ? null : v.id)}
                      >
                        {open === v.id ? "Hide fix" : "Suggest fix"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-caption text-text2">
          Each missing check becomes a fix under <PillarTag pillar="P4" />
        </div>
      </Panel>

      {open === "v1" && (
        <Panel title={`Suggested fix: "${VIDEOS[0].title}"`}>
          <p className="text-caption text-text2">
            Put your tracked question <span className="font-mono">tonkotsu ramen irvine</span> at the start of the title
            and the first line, and add chapters. Fill in your own timestamps.
          </p>
          {v2 ? (
            <EditFlow
              where="YouTube: title and description"
              before={`Our story\n\nThanks for watching! Subscribe for more.`}
              after={`${SUGGESTED.title}\n\n${SUGGESTED.description}`}
              onCancel={() => setOpen(null)}
              onApplied={() => {}}
            />
          ) : (
            <>
              <dl className="grid gap-2 md:grid-cols-2">
                <div className="flex flex-col gap-1 rounded-card border border-border p-2.5">
                  <dt className="text-[11px] font-medium text-inkMuted">New title</dt>
                  <dd className="text-caption">{SUGGESTED.title}</dd>
                </div>
                <div className="flex flex-col gap-1 rounded-card border border-border p-2.5">
                  <dt className="text-[11px] font-medium text-inkMuted">First lines of the description</dt>
                  <dd className="text-caption whitespace-pre-wrap">{SUGGESTED.description}</dd>
                </div>
              </dl>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(`${SUGGESTED.title}\n\n${SUGGESTED.description}`)
                      .catch(() => {});
                    setCopied(true);
                  }}
                >
                  Copy both
                </Button>
                <Button disabled>Apply in YouTube</Button>
                <Tag tone="neutral">Coming soon</Tag>
                {copied && (
                  <span role="status" className="text-caption text-moss">
                    Copied. Paste them in YouTube Studio.
                  </span>
                )}
              </div>
            </>
          )}
        </Panel>
      )}
    </div>
  );
}
