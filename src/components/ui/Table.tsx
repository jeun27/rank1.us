import type { ReactNode } from "react";

export type Column = { key: string; header: string; numeric?: boolean };

export function Table({
  caption,
  columns,
  rows,
  footnote,
}: {
  caption: string;
  columns: Column[];
  rows: Record<string, ReactNode>[];
  footnote?: ReactNode;
}) {
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`border-b border-border px-3 py-2 text-caption font-semibold text-inkMuted ${c.numeric ? "text-right" : "text-left"}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`border-b border-border px-3 py-3 ${c.numeric ? "text-right tabular-nums" : ""}`}
                  >
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
