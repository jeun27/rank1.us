import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Jelly } from "@/components/ui/Jelly";
import { formatPercent } from "@/components/ui/StatNumber";
import { heroLastWeek, heroThisWeek, pointsChange } from "./example-data";
import { container } from "./Section";

export function Hero() {
  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      className={`${container} grid items-center gap-12 py-16 md:grid-cols-2 md:py-24`}
    >
      <div>
        <h1 id="hero-title" className="font-display text-display font-semibold md:text-display-md">
          Be the brand AI names first.
        </h1>
        <p className="mt-6 text-body-lg">
          See how often ChatGPT, Gemini, Google AI Overview and Perplexity name your business, how you stack up against
          competitors, and what to fix next.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Button href="#audit">Get my free audit</Button>
          <Button variant="secondary" href="#pricing">
            See pricing
          </Button>
        </div>
        <p className="mt-4 text-caption text-inkMuted">Same-day results as CSV + PNG. No card.</p>
      </div>
      <div className="flex items-center justify-center gap-6">
        <div className="rounded-surface bg-white p-6 shadow-card" data-hero-card>
          <Badge tone="info">Example data</Badge>
          {/* Reads "named in 34% of 160 answers, +6 pts"; the numbers come from the example fixture. */}
          <p className="mt-3 max-w-56 text-body" data-hero-text>
            named in{" "}
            <span className="font-display text-hero font-semibold tabular-nums">{formatPercent(heroThisWeek)}</span> of{" "}
            <span className="tabular-nums">{heroThisWeek.denominator}</span> answers,{" "}
            <span className="font-semibold text-moss tabular-nums">{pointsChange(heroThisWeek, heroLastWeek)}</span>
          </p>
        </div>
        <Jelly size={180} className="h-auto w-40 shrink-0 md:w-48" />
      </div>
    </section>
  );
}
