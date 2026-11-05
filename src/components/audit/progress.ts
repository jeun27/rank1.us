import { ENGINES, RUNS_PER_ENGINE, type Engine, type RunResults } from "./contract";

const PER_QUESTION = ENGINES.reduce((s, e) => s + RUNS_PER_ENGINE[e], 0);

// Per-engine progress from the run's job total (lead: run_jobs has no member read path).
// q questions → ChatGPT, Gemini and Google AI Overview 3q each, Perplexity q.
export function progressFor(run: RunResults["run"], answers: RunResults["answers"]) {
  const q = Math.floor(run.jobs_total / PER_QUESTION);
  const engines = ENGINES.map((engine: Engine) => {
    const mine = answers.filter((a) => a.engine === engine);
    return {
      engine,
      total: q * RUNS_PER_ENGINE[engine],
      done: mine.length,
      failed: mine.filter((a) => a.status === "failed").length,
    };
  });
  return {
    engines,
    done: engines.reduce((s, e) => s + e.done, 0),
    total: engines.reduce((s, e) => s + e.total, 0),
  };
}
