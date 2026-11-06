"use client";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { PILLARS, type PillarKey } from "./data";
import { Note, Panel, Proto, SECTIONS, Tag } from "./ui";

const WHAT: Record<string, string> = {
  "/dev/gas/loop": "Audit → connect → ready → fixes → score → report, one click per step.",
  "/dev/gas/fixes": "Every fix tagged with the pillar it moves, blockers first. Self-serve and team views.",
  "/dev/gas/ai-access": "The free-audit check for blocked AI bots, JavaScript-only pages and Cloudflare.",
  "/dev/gas/ready": 'The client\'s "You\'re all set" card and the team\'s "Ready for GAS" notice.',
  "/dev/gas/narrative": "Words the client wants and avoids, matched against stored AI answers.",
  "/dev/gas/youtube": "The YouTube tile and a read-only search-ready checklist per video.",
  "/dev/gas/mentions": "Lists AI cites that name your rivals but not you (optional).",
};

export function IndexView() {
  return (
    <Proto
      title="GAS prototypes"
      intro="Clickable UI for each section of the GAS brainstorm. Every page uses Example data and the real v3 shell. Nothing here calls a server. Use the moon button to check the light theme."
    >
      <ul className="grid gap-3 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="group flex h-full flex-col gap-2 rounded-card border border-border bg-white p-4 hover:border-borderStrong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep"
            >
              <span className="flex items-center gap-2">
                <Tag tone="neutral">{s.code}</Tag>
                <span className="text-[13px] font-medium">{s.label}</span>
                <Icon
                  name="arrowRight"
                  className="ml-auto size-4 text-jellyDeep transition-transform group-hover:translate-x-0.5"
                />
              </span>
              <span className="text-caption text-text2">{WHAT[s.href]}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Panel title="The pillars (labels used everywhere)">
        <ul className="grid gap-x-6 gap-y-2 text-caption sm:grid-cols-2">
          {(Object.keys(PILLARS) as PillarKey[]).map((k) => (
            <li key={k} className="flex gap-2">
              <span className="w-6 shrink-0 font-mono text-inkMuted">{k}</span>
              <span>
                <span className="font-medium">{PILLARS[k].label}.</span>{" "}
                <span className="text-text2">{PILLARS[k].why}</span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>
      <Note>
        Designed for the recommended answers: Q1 blockers first, Q2 the ready notice in-app (email TBD), Q3 YouTube
        Recommended for software and online stores, Q4 a read-only YouTube checklist first. Where it was cheap, the
        alternative is one click away on the same page. G6 (robots.txt and sitemap for rank1.us) has no UI.
      </Note>
    </Proto>
  );
}
