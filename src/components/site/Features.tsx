import type { ReactNode } from "react";
import { container } from "./Section";

// Small decorative icons (paths from Lucide, ISC license) in moss and amber.
function FeatureIcon({ className, children }: { className: string; children: ReactNode }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={`size-6 ${className}`}>
      {children}
    </svg>
  );
}

const features = [
  {
    title: "One dashboard",
    icon: (
      <FeatureIcon className="text-moss">
        <rect width="7" height="9" x="3" y="3" rx="1" />
        <rect width="7" height="5" x="14" y="3" rx="1" />
        <rect width="7" height="9" x="14" y="12" rx="1" />
        <rect width="7" height="5" x="3" y="16" rx="1" />
      </FeatureIcon>
    ),
    items: [
      "visibility % with sample size",
      "change since last week's check",
      "competitor leaderboard",
      "every weekly check kept in History",
    ],
  },
  {
    title: "Reports that send themselves",
    icon: (
      <FeatureIcon className="text-amber">
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </FeatureIcon>
    ),
    items: [
      "monthly",
      "white-label with your logo",
      "GA4 traffic",
      "competitor scores",
      "what to fix next",
      "no 'Powered by Rank1' on the $99 plan",
    ],
  },
  {
    title: "Set up in 5 minutes",
    icon: (
      <FeatureIcon className="text-moss">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </FeatureIcon>
    ),
    items: ["auto-suggested questions"],
  },
];

export function Features() {
  return (
    <section id="features" aria-label="Features" className={`${container} py-16 md:py-24`}>
      <ul className="grid gap-6 md:grid-cols-3">
        {features.map((f) => (
          <li key={f.title} className="rounded-surface bg-white p-4 shadow-card md:p-6">
            {f.icon}
            <h2 className="mt-4 font-display text-h3 font-semibold">{f.title}</h2>
            <ul className="mt-3 flex list-disc flex-col gap-1 pl-5">
              {f.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
