import { expect, it } from "vitest";
import { missingKeys, runEngine } from "@/lib/engines";
import { ENGINE_IDS } from "@/lib/engines/types";
import { exampleRamenHouseQuestions } from "../fixtures/example-ramen-house";

// Max 5 questions x 1 run per engine (CLAUDE.md). Prints only status, timing and cost: no answer text.
const MAX_QUESTIONS = 5;
const say = (line: string) => process.stdout.write(`${line}\n`);

it("engines answer live", async () => {
  const missing = missingKeys();
  if (missing.length) {
    say(`skipped: no keys (${missing.join(", ")})`);
    return;
  }
  const questions = exampleRamenHouseQuestions.slice(0, MAX_QUESTIONS);
  let total = 0;
  for (const engine of ENGINE_IDS) {
    for (const q of questions) {
      const started = Date.now();
      const a = await runEngine(engine, {
        question: q.short_text,
        location: { level: "city", country: "US", state: "CA", city: "Irvine" },
      });
      total += a.costUsd ?? 0;
      say(
        `${engine} ${a.status} ${Date.now() - started} ms cost=${a.costUsd ?? "unknown"}${a.error ? ` error=${a.error.slice(0, 80)}` : ""}`,
      );
      expect(["ok", "failed", "no_overview"]).toContain(a.status);
    }
  }
  say(`total cost=${total.toFixed(4)} USD over ${questions.length * ENGINE_IDS.length} calls`);
});
