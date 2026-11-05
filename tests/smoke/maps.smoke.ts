import { it } from "vitest";
import { missingKeys } from "@/lib/engines";
import { findLocalCompetitors } from "@/lib/onboarding";

// Live Maps SERP: at most 5 calls, only with keys. Prints status, timing and counts; no names.
const CUISINES = ["ramen", "sushi", "pho", "Korean BBQ", "brunch"];
const say = (line: string) => process.stdout.write(`${line}\n`);

it("Maps SERP answers live", async () => {
  const missing = missingKeys().filter((k) => k.startsWith("DATAFORSEO"));
  if (missing.length) {
    say(`skipped: no keys (${missing.join(", ")})`);
    return;
  }
  for (const cuisine of CUISINES) {
    const started = Date.now();
    const res = await findLocalCompetitors({ cuisine, city: "Irvine", state: "CA" });
    say(
      `maps ${cuisine} ${res.status} ${Date.now() - started} ms items=${res.items.length}${res.error ? ` error=${res.error.slice(0, 80)}` : ""}`,
    );
  }
});
