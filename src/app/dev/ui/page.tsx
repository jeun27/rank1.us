import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Freshness } from "@/components/ui/Freshness";
import { LoadingState } from "@/components/ui/LoadingState";
import { StatNumber, formatPercent } from "@/components/ui/StatNumber";
import { Table } from "@/components/ui/Table";
import { exampleCheck, exampleLeaderboard, exampleNoAnswers, exampleVisibility } from "./example-data";

export const metadata: Metadata = { title: "UI components", robots: { index: false } };

function Section({ name, children }: { name: string; children: ReactNode }) {
  return (
    <section className="border-t border-border py-8">
      <h2 className="mb-4 font-display text-h2 font-semibold md:text-h2-md">{name}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function change(now: Parameters<typeof formatPercent>[0], before: Parameters<typeof formatPercent>[0]) {
  const pts = parseInt(formatPercent(now)) - parseInt(formatPercent(before));
  return pts === 0 ? "0 pts" : `${pts > 0 ? "+" : "−"}${Math.abs(pts)} pts`;
}

export default function DevUiPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return (
    <main className="mx-auto max-w-page px-5 py-12 md:px-8">
      <h1 className="font-display text-display font-semibold md:text-display-md">UI components</h1>
      <p className="mt-2 text-inkMuted">Every component and state from docs/UI.md. <Badge tone="info">Example data</Badge></p>

      <Section name="Button">
        <div className="flex flex-wrap items-center gap-4">
          <Button>Get my free audit</Button>
          <Button variant="secondary" href="#pricing">See pricing</Button>
          <Button loading>Opening Google…</Button>
          <Button disabled>Add business</Button>
        </div>
        <div className="flex flex-col items-start gap-4 rounded-card bg-ink p-6 text-paper">
          <p className="font-display text-h3 font-semibold">Find out if AI names your business first.</p>
          <Button variant="final">Get my free audit</Button>
        </div>
      </Section>

      <Section name="Card">
        <Card title="Example data">
          <p>Example data: named in 34% of 160 answers, +6 pts</p>
        </Card>
      </Section>

      <Section name="Badge">
        <div className="flex flex-wrap gap-2">
          <Badge tone="success">+6 pts</Badge>
          <Badge tone="error">Paused</Badge>
          <Badge tone="warn">Last run partial: 230 of 250 answers</Badge>
          <Badge tone="info">You</Badge>
        </div>
      </Section>

      <Section name="Banner">
        <Banner tone="error" action={{ label: "Try again", href: "#banner" }}>
          We couldn&apos;t load your results. Try again.
        </Banner>
        <Banner tone="info">ChatGPT can&apos;t target a city yet, so we check it for the whole country.</Banner>
      </Section>

      <Section name="Table">
        <Table
          caption="Competitor leaderboard (Example data)"
          columns={[
            { key: "brand", header: "Brand" },
            { key: "visibility", header: "Visibility", numeric: true },
            { key: "change", header: "Change", numeric: true },
          ]}
          rows={exampleLeaderboard.map((r) => ({
            brand: (
              <span className="flex flex-wrap items-center gap-2">
                {r.brand} {r.you && <Badge tone="info">You</Badge>}
              </span>
            ),
            visibility: formatPercent(r.now),
            change: change(r.now, r.lastWeek),
          }))}
          footnote={<Freshness checkedAt={exampleCheck.checkedAt} answers={exampleCheck.answers} now={exampleCheck.now} />}
        />
      </Section>

      <Section name="StatNumber">
        <div className="flex flex-wrap gap-12">
          <StatNumber metric={exampleVisibility} />
          <StatNumber metric={exampleNoAnswers} />
        </div>
      </Section>

      <Section name="EmptyState">
        <Card>
          <EmptyState
            message="Nothing tracked yet. Add your domain and I'll find the questions."
            action={{ label: "Add my business", href: "#empty" }}
          />
        </Card>
      </Section>

      <Section name="LoadingState">
        <Card>
          <LoadingState message="Checking 4 AI engines… 120 of 250 answers" decorativeJelly />
        </Card>
      </Section>

      <Section name="Freshness">
        <Freshness checkedAt={exampleCheck.checkedAt} answers={exampleCheck.answers} now={exampleCheck.now} />
      </Section>
    </main>
  );
}
