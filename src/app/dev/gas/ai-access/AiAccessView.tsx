"use client";
import { Banner } from "@/components/ui/Banner";
import { DomainField } from "@/components/ui/DomainField";
import { Icon } from "@/components/ui/Icon";
import { LoadingState } from "@/components/ui/LoadingState";
import { BUSINESS } from "../data";
import type { Query } from "../params";
import { Checked, Note, Panel, PillarTag, Proto, Status, TextAction } from "../ui";

const STATES = [
  { key: "good", label: "All good" },
  { key: "blocked", label: "Blocked bots" },
  { key: "js", label: "Needs JavaScript" },
  { key: "cloudflare", label: "Cloudflare hint" },
  { key: "unreachable", label: "Site unreachable" },
  { key: "none", label: "No website given" },
  { key: "loading", label: "Checking" },
];

type Crawler = { who: string; bot: string; blocked?: string };
const crawlers = (blocked: boolean): Crawler[] => [
  { who: "ChatGPT (training)", bot: "GPTBot" },
  { who: "ChatGPT search", bot: "OAI-SearchBot", blocked: blocked ? "robots.txt line 4: Disallow: /menu" : undefined },
  { who: "Claude", bot: "ClaudeBot", blocked: blocked ? "robots.txt line 7: Disallow: /menu" : undefined },
  { who: "Gemini (training)", bot: "Google-Extended" },
];

export function AiAccessView({ q }: { q: Query }) {
  const state = STATES.some((s) => s.key === q.state) ? q.state! : "good";
  return (
    <Proto
      title="Can AI see your site?"
      intro="G2. A free check on the audit results (no login): robots.txt for the 4 AI crawlers, one page loaded with JavaScript off, and a Cloudflare hint. Every problem becomes a fix under P5 Technical access."
      states={STATES}
      state={state}
    >
      <AccessCheck state={state} />
      <Note>
        Placement: on /audit (dark only) under the leaderboard, and as a card on /app/fixes. Server guards from the
        brainstorm (R1): public addresses only, strict time and size limits, no logins, no redirects to private
        networks.
      </Note>
    </Proto>
  );
}

function AccessCheck({ state }: { state: string }) {
  if (state === "loading")
    return (
      <Panel title="Can AI see your site?">
        <LoadingState message="Checking robots.txt and loading your site…" decorativeJelly={false} />
      </Panel>
    );
  if (state === "none")
    return (
      <Panel title="Can AI see your site?">
        <div className="flex flex-col items-start gap-3 py-2">
          <p className="text-ui">Add your website and we&apos;ll check if AI can read it.</p>
          <DomainField label="Your website" placeholder="yoursite.com" buttonLabel="Check my site" />
          <p className="text-caption text-inkMuted">No login needed. We only read public pages.</p>
        </div>
      </Panel>
    );
  if (state === "unreachable")
    return (
      <Panel title="Can AI see your site?" aside={<Domain />}>
        <Banner tone="error" action={{ label: "Try again", onClick: () => {} }}>
          {`We couldn't reach ${BUSINESS.domain}. Check the address, then try again.`}
        </Banner>
        <p className="text-caption text-inkMuted">
          The rest of your audit is saved. If the site is down for AI, it&apos;s down for customers too.
        </p>
      </Panel>
    );

  const blocked = state === "blocked";
  const js = state === "js";
  const cloudflare = state === "cloudflare";
  const list = crawlers(blocked);
  const nBlocked = list.filter((c) => c.blocked).length;
  const summary = blocked
    ? { tone: "error" as const, text: `${nBlocked} of 4 AI crawlers are blocked from your menu.` }
    : js
      ? { tone: "error" as const, text: "Your menu is empty without JavaScript, so ChatGPT sees no dishes." }
      : cloudflare
        ? { tone: "warn" as const, text: "Your site lets AI in, but Cloudflare may be blocking it." }
        : { tone: "success" as const, text: "AI can read your site." };

  return (
    <Panel title="Can AI see your site?" aside={<Domain />}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Status tone={summary.tone}>{summary.text}</Status>
        <Checked>Checked 3 min ago · robots.txt + 2 pages</Checked>
      </div>

      <div
        role="region"
        aria-label="AI crawlers"
        tabIndex={0}
        className="overflow-x-auto rounded-card border border-border focus-visible:outline-2 focus-visible:outline-jellyDeep"
      >
        <table className="w-full min-w-[34rem] border-collapse text-caption">
          <caption className="sr-only">AI crawlers and robots.txt</caption>
          <thead className="sticky top-0 bg-white">
            <tr className="text-left text-inkMuted">
              <th scope="col" className="border-b border-border px-3 py-2 font-medium">
                AI
              </th>
              <th scope="col" className="border-b border-border px-3 py-2 font-medium">
                Crawler
              </th>
              <th scope="col" className="border-b border-border px-3 py-2 font-medium">
                Result
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.bot} className="hover:bg-ink/[0.04]">
                <td className="border-b border-border px-3 py-2.5">{c.who}</td>
                <td className="border-b border-border px-3 py-2.5 font-mono">{c.bot}</td>
                <td className="border-b border-border px-3 py-2.5">
                  {c.blocked ? (
                    <span className="flex flex-col gap-0.5">
                      <Status tone="error">Blocked</Status>
                      <span className="font-mono text-inkMuted">{c.blocked}</span>
                    </span>
                  ) : (
                    <Status tone="success">Allowed</Status>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 rounded-card border border-border p-3">
        <h3 className="text-[13px] font-medium">With JavaScript off</h3>
        <ul className="flex flex-col gap-1.5 text-caption">
          <li className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Home page <span className="font-mono text-inkMuted">/</span>
            </span>
            <Status tone="success">Text shows</Status>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Menu <span className="font-mono text-inkMuted">/menu</span>
            </span>
            {js ? <Status tone="error">Empty: 0 dishes</Status> : <Status tone="success">18 dishes show</Status>}
          </li>
        </ul>
      </div>

      {cloudflare && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-card border border-jellyDeep/25 bg-infoBg p-3 text-jellyDeep"
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/10">
            <Icon name="info" className="size-4" />
          </span>
          <p className="text-caption">
            Your site runs on Cloudflare. Its AI bot blocking is on by default for many new sites, and robots.txt
            can&apos;t show it. Check Security, then Bots, in your Cloudflare dashboard.
          </p>
        </div>
      )}

      {(blocked || js || cloudflare) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-3">
          <span className="text-caption text-text2">
            {blocked || js ? "Added to your fix list" : "Added as a check"}
          </span>
          <PillarTag pillar="P5" />
          <TextAction href="/dev/gas/fixes">See what to fix</TextAction>
        </div>
      )}

      <p className="text-caption text-inkMuted">
        We read robots.txt and load your pages the way each crawler would. We don&apos;t check llms.txt: no major AI
        reads it.
      </p>
    </Panel>
  );
}

const Domain = () => <span className="font-mono text-caption text-text2">{BUSINESS.domain}</span>;
