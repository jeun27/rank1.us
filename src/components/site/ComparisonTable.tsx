import { Button } from "@/components/ui/Button";
import { Section } from "./Section";

const columns = ["Manual checks", "Enterprise AI trackers", "Rank1"];
const rows: [string, string, string, string][] = [
  ["Setup", "hours", "sales call + onboarding", "5 minutes"],
  ["Competitor leaderboard", "manual", "varies", "yes"],
  ["White-label report", "build it yourself", "varies", "yes"],
  ["GA4 traffic in report", "manual", "varies", "yes"],
  ["Price for one business", "your time", "enterprise pricing", "$99/mo self-serve"],
];

// The only horizontal scroll on the page: below md the table scrolls with the Rank1 column pinned right.
const rank1 = "sticky right-0 w-32 border-l border-border bg-infoBg font-semibold";
const cell = "border-b border-border px-3 py-3 text-left";

export function ComparisonTable() {
  return (
    <Section id="comparison" title="Built for one business, not 500 brands.">
      <div
        data-scroll-exempt
        tabIndex={0}
        className="overflow-x-auto rounded-frame border border-border bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep"
      >
        <table aria-labelledby="comparison-title" className="w-full min-w-[34rem] table-fixed border-collapse">
          <thead>
            <tr>
              <td className={`${cell} w-28 md:w-auto`} />
              {columns.map((c) => (
                <th
                  key={c}
                  scope="col"
                  className={`${cell} sticky top-0 z-10 text-caption font-semibold ${c === "Rank1" ? `${rank1} z-20 text-jellyDeep` : "bg-white text-inkMuted"}`}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, manual, enterprise, ours]) => (
              <tr key={label}>
                <th scope="row" className={`${cell} font-semibold`}>
                  {label}
                </th>
                <td className={cell}>{manual}</td>
                <td className={cell}>{enterprise}</td>
                <td className={`${cell} ${rank1} text-ink`}>{ours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-caption text-inkMuted">
        Enterprise column is a general description, not a specific product.
      </p>
      <div className="mt-8">
        <Button variant="secondary" href="#audit">
          Start with a free audit
        </Button>
      </div>
    </Section>
  );
}
