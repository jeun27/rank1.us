import type { ReactNode } from "react";

export type Column = { key: string; header: string; numeric?: boolean };

// stack: below md each row is two lines, the first column + the result (the first numeric column, else the
// last) on line 1 and the others under it with their header. CSS only, so it stays a real table.
// pin(i): that row is tinted (infoBg, the You row) and moved first on phones; the DOM order is kept.
export function Table({
  caption,
  columns,
  rows,
  footnote,
  stack = false,
  pin,
}: {
  caption: string;
  columns: Column[];
  rows: Record<string, ReactNode>[];
  footnote?: ReactNode;
  stack?: boolean;
  pin?: (index: number) => boolean;
}) {
  // Safari can drop table semantics once CSS changes display on tr/tbody (reviewer S1), so say them.
  const role = (r: string) => (stack ? r : undefined);
  const resultKey = (columns.find((c) => c.numeric) ?? columns.at(-1))?.key;
  const cellStack = (c: Column, i: number) =>
    !stack
      ? ""
      : i === 0
        ? "max-md:row-start-1 max-md:col-start-1 max-md:border-0 max-md:p-0"
        : c.key === resultKey
          ? "max-md:row-start-1 max-md:col-start-2 max-md:border-0 max-md:p-0"
          : "max-md:col-span-2 max-md:border-0 max-md:p-0 max-md:text-left max-md:text-caption max-md:text-inkMuted";
  return (
    <div>
      <div className="overflow-x-auto">
        <table role={role("table")} className="w-full border-collapse">
          <caption className="sr-only">{caption}</caption>
          <thead role={role("rowgroup")} className={stack ? "max-md:sr-only" : undefined}>
            <tr role={role("row")}>
              {columns.map((c) => (
                <th
                  role={role("columnheader")}
                  key={c.key}
                  scope="col"
                  className={`sticky top-0 border-b border-border bg-white px-3 py-2 text-caption font-semibold text-inkMuted ${c.numeric ? "text-right" : "text-left"}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody role={role("rowgroup")} className={stack && pin ? "max-md:flex max-md:flex-col" : undefined}>
            {rows.map((row, i) => (
              <tr
                role={role("row")}
                key={i}
                className={[
                  stack &&
                    "max-md:grid max-md:min-h-11 max-md:grid-cols-[1fr_auto] max-md:items-center max-md:gap-x-3 max-md:gap-y-0.5 max-md:border-b max-md:border-border max-md:p-3",
                  pin?.(i) && "bg-infoBg max-md:order-first",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {columns.map((c, ci) => (
                  <td
                    role={role("cell")}
                    key={c.key}
                    className={`border-b border-border px-3 py-3 ${c.numeric ? "text-right tabular-nums" : ""} ${cellStack(c, ci)}`}
                  >
                    {stack && ci > 0 && c.key !== resultKey && (
                      <span data-stack-label aria-hidden="true" className="md:hidden">
                        {`${c.header} `}
                      </span>
                    )}
                    {row[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footnote && <div className="mt-2 text-caption text-inkMuted">{footnote}</div>}
    </div>
  );
}
