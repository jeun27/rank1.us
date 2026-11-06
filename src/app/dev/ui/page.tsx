import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AuroraButton } from "@/components/ui/AuroraButton";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DomainField, type DomainFieldProps } from "@/components/ui/DomainField";
import { EmptyState } from "@/components/ui/EmptyState";
import { Freshness } from "@/components/ui/Freshness";
import { LoadingState } from "@/components/ui/LoadingState";
import { Logo } from "@/components/ui/Logo";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatNumber, formatPercent } from "@/components/ui/StatNumber";
import { Table } from "@/components/ui/Table";
import {
  exampleCheck,
  exampleDomain,
  exampleDomainNoEnding,
  exampleLeaderboard,
  exampleNoAnswers,
  examplePartialRun,
  exampleProgress,
  exampleVisibility,
  partialRunLabel,
  pointsChange,
} from "./example-data";

export const metadata: Metadata = { title: "UI components", robots: { index: false } };

const you = exampleLeaderboard.find((r) => r.you)!;

// Strings from docs/COPY.md.
const auditField: DomainFieldProps = {
  label: "Your domain",
  placeholder: "yourbusiness.com",
  buttonLabel: "Get my free audit",
  loadingLabel: "Checking…",
  errorText: "Add the ending, like ramenhouse.com",
};
const emptyField: DomainFieldProps = {
  label: "Your domain",
  placeholder: "yoursite.com",
  buttonLabel: "Add my business",
};
const emptyMessage = "Nothing tracked yet. Add your domain and I'll find the questions.";
const loadingMessage = "Checking 4 AI engines…";

const fieldStates = [
  { state: "Default", props: {} },
  { state: "Focused", props: { defaultValue: exampleDomain, focused: true } },
  { state: "Loading", props: { defaultValue: exampleDomain, state: "loading" } },
  { state: "Error", props: { defaultValue: exampleDomainNoEnding, state: "error" } },
] satisfies { state: string; props: Partial<DomainFieldProps> }[];

function FieldStates() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {fieldStates.map(({ state, props }) => (
        <div key={state} className="flex min-w-0 flex-col gap-2">
          <DomainField {...auditField} {...props} />
          <p className="text-caption text-inkMuted">{state}</p>
        </div>
      ))}
    </div>
  );
}

function SetRow({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <div className="grid gap-4 md:grid-cols-[190px_1fr] md:gap-8">
      <div className="md:pt-3">
        <h3 className="text-ui font-semibold">{title}</h3>
        <p className="text-caption text-inkMuted">{note}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </div>
  );
}

function Section({ name, example, children }: { name: string; example?: boolean; children: ReactNode }) {
  return (
    <section className="border-t border-border py-8">
      <h2 className="mb-4 font-display text-h2 font-semibold md:text-h2-md">{name}</h2>
      {example && (
        <p className="mb-4">
          <Badge tone="info">Example data</Badge>
        </p>
      )}
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export default function DevUiPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return (
    <main className="mx-auto max-w-page px-5 py-12 md:px-8">
      <h1 className="font-display text-display font-semibold md:text-display-md">UI components</h1>
      <p className="mt-2 text-inkMuted">
        Every component and state from docs/UI.md. <Badge tone="info">Example data</Badge>
      </p>

      <Section name="Logo">
        <Logo />
        <div className="flex flex-wrap items-end gap-8">
          {[24, 48, 96].map((h) => (
            // eslint-disable-next-line @next/next/no-img-element -- show the raw public asset
            <img key={h} src="/logo-mark.svg" alt={`Rank1 logo mark, ${h}px`} width={(h * 4) / 3} height={h} />
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-8">
          {[32, 64, 180].map((h) => (
            // eslint-disable-next-line @next/next/no-img-element -- show the raw public asset
            <img key={h} src="/app-icon.svg" alt={`Rank1 app icon, ${h}px`} width={h} height={h} />
          ))}
        </div>
      </Section>

      <Section name="Button">
        <div className="flex flex-wrap items-center gap-4">
          <Button>Get my free audit</Button>
          <Button variant="secondary" href="#pricing">
            See pricing
          </Button>
          <Button loading>Checking…</Button>
          <Button disabled>Add business</Button>
        </div>
        <div className="flex flex-col items-start gap-4 rounded-card bg-ink p-6 text-paper">
          <p className="font-display text-h3 font-semibold">Find out if AI names your business first.</p>
          <Button variant="final">Get my free audit</Button>
        </div>
      </Section>

      <Section name="DomainField" example>
        <FieldStates />
      </Section>

      <Section name="AuroraButton">
        <div className="flex flex-wrap gap-4">
          <AuroraButton loading>Opening Google…</AuroraButton>
        </div>
      </Section>

      <Section name="Card" example>
        <Card title={you.brand}>
          <StatNumber metric={you.now} />
        </Card>
      </Section>

      <Section name="Badge" example>
        <div className="flex flex-wrap gap-2">
          <Badge tone="success" mono>
            {pointsChange(you.now, you.lastWeek)}
          </Badge>
          <Badge tone="error">Paused</Badge>
          <Badge tone="warn">{partialRunLabel(examplePartialRun)}</Badge>
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
            change: pointsChange(r.now, r.lastWeek),
          }))}
          footnote={
            <Freshness checkedAt={exampleCheck.checkedAt} answers={exampleCheck.answers} now={exampleCheck.now} />
          }
        />
      </Section>

      <Section name="StatNumber" example>
        <div className="flex flex-wrap gap-12">
          <StatNumber metric={exampleVisibility} />
          <StatNumber metric={exampleNoAnswers} />
        </div>
      </Section>

      <Section name="ProgressBar" example>
        <ProgressBar done={exampleProgress.answersDone} total={exampleProgress.answersTotal} />
      </Section>

      <Section name="EmptyState">
        <Card className="max-w-105">
          <EmptyState message={emptyMessage} field={emptyField} />
        </Card>
      </Section>

      <Section name="LoadingState" example>
        <Card className="max-w-105">
          <LoadingState
            message={loadingMessage}
            done={exampleProgress.answersDone}
            total={exampleProgress.answersTotal}
            decorativeJelly
          />
        </Card>
      </Section>

      <Section name="Freshness" example>
        <Freshness checkedAt={exampleCheck.checkedAt} answers={exampleCheck.answers} now={exampleCheck.now} />
      </Section>

      <Section name="Final set" example>
        <Card>
          <div className="flex flex-col gap-10">
            <div>
              <p className="font-display text-h3 font-semibold">Final set</p>
              <p className="text-inkMuted">
                Each action and state has its own look, so people can tell them apart at a glance.
              </p>
            </div>
            <SetRow title="Get my free audit" note="Field + Button. Default, focused, loading, error.">
              <FieldStates />
            </SetRow>
            <SetRow title="Opening Google…" note="Aurora ring. The only aurora button.">
              <div>
                <AuroraButton loading>Opening Google…</AuroraButton>
              </div>
            </SetRow>
            <SetRow title="See pricing · Add business" note="Text link, and the disabled pill.">
              <div className="flex flex-wrap items-center gap-6">
                <Button variant="secondary" href="#pricing">
                  See pricing
                </Button>
                <Button disabled>Add business</Button>
              </div>
            </SetRow>
            <SetRow title="Banners" note="Red edge for errors, blue edge for info. Actions use the text link.">
              <Banner tone="error" action={{ label: "Try again", href: "#banner" }}>
                We couldn&apos;t load your results. Try again.
              </Banner>
              <Banner tone="info">ChatGPT can&apos;t target a city yet, so we check it for the whole country.</Banner>
            </SetRow>
            <SetRow title="Freshness" note="Under every number.">
              <Freshness checkedAt={exampleCheck.checkedAt} answers={exampleCheck.answers} now={exampleCheck.now} />
            </SetRow>
            <SetRow title="Empty · Loading" note="Empty uses Field + Button. Loading uses a blue spinner and bar.">
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="md:px-4">
                  <EmptyState message={emptyMessage} field={emptyField} decorativeJelly />
                </Card>
                <Card className="md:px-4">
                  <LoadingState
                    message={loadingMessage}
                    done={exampleProgress.answersDone}
                    total={exampleProgress.answersTotal}
                    decorativeJelly
                  />
                </Card>
              </div>
            </SetRow>
          </div>
        </Card>
      </Section>
    </main>
  );
}
