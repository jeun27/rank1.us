import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Section } from "./Section";

const steps = [
  "Add your domain - Rank1 suggests questions. 5-minute setup.",
  "Rank1 checks 4 AI engines every week.",
  "You get a monthly report with GA4 traffic, competitor scores and what to fix next.",
];

export function HowItWorks() {
  return (
    <Section id="how-it-works" title="Customers ask AI who to pick. Find out if it names you.">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="rounded-surface border-[1.5px] border-brick bg-white p-4 shadow-banner-error md:p-6">
          <Badge tone="error">Before</Badge>
          <p className="mt-3 text-body-lg text-brick">
            Pasting questions into 4 chatbots by hand and logging answers in a spreadsheet.
          </p>
        </div>
        <ol className="flex list-decimal flex-col gap-4 pl-6 text-body-lg marker:font-display marker:font-semibold">
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </div>
      <div className="mt-8">
        <Button variant="secondary" href="#audit">
          Get my free audit
        </Button>
      </div>
    </Section>
  );
}
