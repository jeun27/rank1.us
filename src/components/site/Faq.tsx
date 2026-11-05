import { Section } from "./Section";

// Answers are COPY.md's exact phrases, capitalized with a closing period (lead, 2026-11-05).
const faqs: [string, string][] = [
  ["Which AI engines?", "ChatGPT, Gemini, Google AI Overview, Perplexity"],
  [
    "What does visibility % mean?",
    "the share of answers where AI names your business, always shown with the sample size",
  ],
  ["How long is setup?", "about 5 minutes"],
  ["Can I white-label?", "yes; the $99 plan includes white-label reports with your own logo and no Rank1 credit"],
  ["Do I need GA4?", "optional; adds traffic to the report"],
  ["What's in the free audit?", "same-day CSV + PNG"],
  [
    "Why do results change week to week?",
    "AI answers vary between runs, so we ask each question several times and show how many answers each number is based on",
  ],
];

export const sentence = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}.`;

export function Faq() {
  return (
    <Section id="faq" title="FAQ">
      <div className="flex max-w-3xl flex-col divide-y divide-border border-y border-border">
        {faqs.map(([q, a]) => (
          <details key={q} className="group">
            <summary className="flex min-h-11 cursor-pointer items-center py-3 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep">
              {q}
            </summary>
            <p className="pb-4 text-inkMuted">{sentence(a)}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
