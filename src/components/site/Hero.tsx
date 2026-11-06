import { Button } from "@/components/ui/Button";
import { HeroDemo } from "./HeroDemo";
import { demoEngines } from "./demo-data";
import { container } from "./Section";

// An engine name inside the sub sentence, in ink on the text2 sentence. X20 (founder OK): plain text, no
// bordered chip with a dot, which read as a button (replaces that part of D37).
function EngineTag({ name }: { name: string }) {
  return (
    <span data-engine-tag className="text-ink">
      {name}
    </span>
  );
}

// v3 (D37): the H1 and CTA on the left, the sub on the right (stacked below md), then the live demo window
// with a soft accent glow behind it (D39, decorative).
export function Hero() {
  const [chatgpt, gemini, aio, perplexity] = demoEngines.map((e) => <EngineTag key={e.engine} name={e.engine} />);
  return (
    <section
      id="hero"
      aria-labelledby="hero-title"
      className={`${container} relative isolate overflow-x-clip py-16 md:py-24`}
    >
      <div
        aria-hidden="true"
        data-glow
        className="glow pointer-events-none absolute -top-16 left-1/2 -z-10 h-80 w-full max-w-3xl -translate-x-1/2"
      />
      <div className="grid gap-8 md:grid-cols-2 md:items-end md:gap-12">
        <div>
          <h1 id="hero-title" className="font-display text-display font-semibold md:text-display-md">
            <span className="block">Be the brand</span> <span className="block text-accent">AI names first.</span>
          </h1>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button size="lg" href="#audit">
              Get my free audit
            </Button>
            <Button variant="secondary" href="#pricing">
              See pricing
            </Button>
          </div>
          <p className="mt-4 text-caption text-inkMuted">Same-day results as CSV + PNG. No card.</p>
        </div>
        <p data-hero-sub className="text-body-lg leading-8 text-text2">
          See how often {chatgpt}, {gemini}, {aio} and {perplexity} name your business, how you stack up against
          competitors, and what to fix next.
        </p>
      </div>
      <div className="relative isolate mt-12 md:mt-16">
        <div aria-hidden="true" data-glow className="glow pointer-events-none absolute -inset-8 -z-10" />
        <HeroDemo />
      </div>
    </section>
  );
}
