"use client";
import { useState } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import type { Query } from "../params";
import { Blocks, Checked, Note, Panel, PillarTag, Proto, Status } from "../ui";

const STATES = [
  { key: "success", label: "Success" },
  { key: "partial", label: "Partial" },
  { key: "empty", label: "Empty" },
  { key: "loading", label: "Loading" },
  { key: "error", label: "Error" },
];

// From the cited links we already store (sources), Example data: pages AI cites that name rivals but not you.
const LISTS = [
  {
    domain: "oc-eats.example",
    page: "The 12 best ramen shops in Irvine",
    rivals: ["Example Noodle Bar", "Example Tonkotsu Co."],
    cited: 11,
  },
  {
    domain: "irvine-weekly.example",
    page: "Where to eat late at Diamond Jamboree",
    rivals: ["Example Noodle Bar", "Example Udon Spot"],
    cited: 7,
  },
  { domain: "socal-noodles.example", page: "Vegan ramen worth the drive", rivals: ["Example Tonkotsu Co."], cited: 4 },
];

export function MentionsView({ q }: { q: Query }) {
  const state = STATES.some((s) => s.key === q.state) ? q.state! : "success";
  return (
    <Proto
      title="Lists that name your rivals but not you"
      intro="G7 (optional). We already store every link AI cites. Pages that name your competitors but not you are the quickest mention wins: ask to be added. Nothing is sent from here; the team or client reaches out."
      states={STATES}
      state={state}
    >
      <Body state={state} />
    </Proto>
  );
}

function Body({ state }: { state: string }) {
  const [picked, setPicked] = useState<Record<string, "added" | "skipped">>({});
  if (state === "loading") return <Blocks label="Loading lists" />;
  if (state === "error")
    return (
      <Banner tone="error" action={{ label: "Try again", onClick: () => {} }}>
        We couldn&apos;t load your results. Try again.
      </Banner>
    );
  if (state === "empty")
    return (
      <Panel>
        <p className="text-ui">No lists like this yet. They show after your first run.</p>
      </Panel>
    );
  const rows = state === "partial" ? LISTS.slice(0, 1) : LISTS;
  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="Mention targets"
        aside={<Checked>Checked 14 h ago · 250 answers · API-measured, directional</Checked>}
      >
        {state === "partial" && <p className="text-caption text-text2">No links cited by Perplexity</p>}
        <div className="max-h-[28rem] overflow-auto rounded-card border border-border">
          <table className="w-full min-w-[40rem] border-collapse text-caption">
            <caption className="sr-only">Pages AI cites that name competitors but not you</caption>
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="text-left text-inkMuted">
                <th scope="col" className="border-b border-border px-3 py-2 font-medium">
                  Page
                </th>
                <th scope="col" className="border-b border-border px-3 py-2 font-medium">
                  Names
                </th>
                <th scope="col" className="border-b border-border px-3 py-2 text-right font-medium">
                  Cited in
                </th>
                <th scope="col" className="border-b border-border px-3 py-2 font-medium">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.domain} className="hover:bg-ink/[0.04]">
                  <th scope="row" className="border-b border-border px-3 py-2.5 text-left font-normal">
                    <span className="block font-medium">{r.page}</span>
                    <span className="font-mono text-inkMuted">{r.domain}</span>
                  </th>
                  <td className="border-b border-border px-3 py-2.5 text-text2">{r.rivals.join(", ")}</td>
                  <td className="border-b border-border px-3 py-2.5 text-right whitespace-nowrap">
                    <span className="font-mono tabular-nums">{r.cited}</span> answers
                  </td>
                  <td className="border-b border-border px-3 py-2.5">
                    {picked[r.domain] === "added" ? (
                      <Status tone="success">Added to fixes</Status>
                    ) : picked[r.domain] === "skipped" ? (
                      <Status tone="muted">Not relevant</Status>
                    ) : (
                      <span className="flex gap-1.5">
                        <Button variant="alt" onClick={() => setPicked({ ...picked, [r.domain]: "added" })}>
                          Add to fixes
                        </Button>
                        <Button variant="alt" onClick={() => setPicked({ ...picked, [r.domain]: "skipped" })}>
                          Not relevant
                        </Button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-caption text-text2">
          &quot;Add to fixes&quot; creates one fix under <PillarTag pillar="P3" />
        </div>
      </Panel>
      <Note>
        One number per row (cited in n answers), so it stays under the 3-number rule. Only domains AI cited are listed;
        we don&apos;t crawl the web for more.
      </Note>
    </div>
  );
}
