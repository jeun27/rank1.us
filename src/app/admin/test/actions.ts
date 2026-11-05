"use server";

import { requireFounder } from "@/lib/admin/founder";
import { runEngine } from "@/lib/engines";
import { ENGINE_IDS, type EngineAnswer, type EngineId, type LocationLevel } from "@/lib/engines/types";

export type EngineTestResult = Omit<EngineAnswer, "raw"> | { invalid: true } | null;

const LEVELS: LocationLevel[] = ["country", "state", "city"];

// The page is the first gate; the action checks again because server actions are public endpoints.
export async function runEngineTest(_prev: EngineTestResult, form: FormData): Promise<EngineTestResult> {
  await requireFounder();
  const engine = String(form.get("engine")) as EngineId;
  const level = String(form.get("level")) as LocationLevel;
  const question = String(form.get("question") ?? "").trim();
  if (!ENGINE_IDS.includes(engine) || !LEVELS.includes(level) || !question || question.length > 500) {
    return { invalid: true };
  }
  const answer: Partial<EngineAnswer> = await runEngine(engine, {
    question,
    location: { level, country: "US", state: "CA", city: "Irvine" },
  });
  delete answer.raw; // raw vendor JSON stays server-side
  return answer as Omit<EngineAnswer, "raw">;
}
