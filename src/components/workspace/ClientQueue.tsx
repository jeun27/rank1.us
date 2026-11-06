import { appCopy as c } from "@/components/app/copy";
import { auditCopy } from "@/components/audit/copy";
import { Badge } from "@/components/ui/Badge";
import { formatPercent } from "@/components/ui/StatNumber";
import { Table } from "@/components/ui/Table";
import { deltaTone, signedPts } from "@/lib/metrics/delta";
import { QUEUE_TAGS, type QueueRow } from "@/lib/workspace/queue";

// X5: who needs the team first. Status on the left (F-pattern), ≤3 numbers per row, every % with its n.
// A row opens that client, like the switcher.
export function ClientQueue({ rows, formAction }: { rows: QueueRow[]; formAction: string }) {
  const tags = rows.some((r) => r.tag);
  return (
    <Table
      caption="Clients"
      stack
      columns={[
        ...(tags ? [{ key: "s", header: "Status" }] : []),
        { key: "b", header: auditCopy.business },
        { key: "v", header: c.visibility, numeric: true },
        { key: "c", header: c.change, numeric: true },
        { key: "o", header: c.fixNext, numeric: true },
      ]}
      rows={rows.map((r) => ({
        s: r.tag && <Badge tone={QUEUE_TAGS[r.tag].tone}>{QUEUE_TAGS[r.tag].label}</Badge>,
        b: (
          <a
            href={`${formAction}?b=${encodeURIComponent(r.id)}`}
            className="inline-flex min-h-11 items-center font-medium text-link underline underline-offset-4 md:min-h-8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jellyDeep"
          >
            <span data-computed>{r.name}</span>
          </a>
        ),
        v: (
          <span data-computed>
            {r.visibility?.denominator
              ? `${formatPercent(r.visibility)} (named in ${r.visibility.numerator} of ${r.visibility.denominator} answers)`
              : "–"}
          </span>
        ),
        c:
          r.delta === null ? (
            "–"
          ) : (
            <Badge tone={deltaTone(r.delta)} mono>
              {signedPts(r.delta)}
            </Badge>
          ),
        o: <span data-computed>{r.open}</span>,
      }))}
    />
  );
}
