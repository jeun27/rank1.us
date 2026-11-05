// Real Irvine restaurants from the founder's CSV (City of Irvine license list + center directories, 2026-11-04).
// Trimmed to non-sales columns; ratings, emails and pitch notes were dropped and must never be added back.
// Dev seed and tests only: never create runs, answers, citations or fixes for these names.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const IRVINE_RESTAURANT_COLUMNS = [
  "name",
  "address",
  "cluster",
  "cuisine",
  "website",
  "enr_website",
  "phone",
  "chain_flag",
  "google_status",
  "checked_date",
  "source",
] as const;

export type IrvineRestaurant = Record<(typeof IRVINE_RESTAURANT_COLUMNS)[number], string>;

export const IRVINE_RESTAURANTS_CSV = join(__dirname, "irvine_restaurants.csv");

// RFC 4180: quoted fields may contain commas, newlines and doubled quotes.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function loadIrvineRestaurants(path = IRVINE_RESTAURANTS_CSV): {
  header: string[];
  rows: IrvineRestaurant[];
} {
  const [header, ...body] = parseCsv(readFileSync(path, "utf8"));
  const rows = body.map((cells, n) => {
    if (cells.length !== header.length)
      throw new Error(`row ${n + 2}: ${cells.length} cells, expected ${header.length}`);
    return Object.fromEntries(header.map((h, i) => [h, cells[i]])) as IrvineRestaurant;
  });
  return { header, rows };
}

export const { header: irvineRestaurantsHeader, rows: irvineRestaurants } = loadIrvineRestaurants();

export const irvineClusters: string[] = [...new Set(irvineRestaurants.map((r) => r.cluster).filter(Boolean))].sort();
