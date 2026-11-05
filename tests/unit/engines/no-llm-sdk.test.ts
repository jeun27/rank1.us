import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Engines only fetch answers; nothing may call an LLM for detection. Matches package names, not the
// bare word "openai" (Perplexity model ids like "openai/gpt-…" are strings, not SDKs).
const LLM_SDK =
  /^(openai|@openai\/.*|@anthropic-ai\/.*|@google\/genai|@google\/generative-ai|@google-cloud\/vertexai|@mistralai\/.*|cohere-ai|ai|@ai-sdk\/.*|langchain|@langchain\/.*|llamaindex|@perplexity-ai\/.*|groq-sdk|ollama|replicate|together-ai|@huggingface\/inference|@aws-sdk\/client-bedrock.*)$/;

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f) ? [p] : [];
  });

describe("no LLM SDK", () => {
  it("package.json has no LLM SDK dependency", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const deps = Object.keys({
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.optionalDependencies,
      ...pkg.peerDependencies,
    });
    expect(deps.length).toBeGreaterThan(0);
    expect(deps.filter((d) => LLM_SDK.test(d))).toEqual([]);
  });

  it("src/ imports no LLM SDK", () => {
    const spec = /(?:from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)["']([^"']+)["']/g;
    const hits = files("src").flatMap((f) =>
      [...readFileSync(f, "utf8").matchAll(spec)]
        .map((m) => m[1].replace(/^((?:@[^/]+\/)?[^/]+).*$/, "$1"))
        .filter((name) => LLM_SDK.test(name) || LLM_SDK.test(name.split("/")[0]))
        .map((name) => `${f}: ${name}`),
    );
    expect(hits).toEqual([]);
  });

  it("the matcher catches real SDK imports (control)", () => {
    for (const name of [
      "openai",
      "@anthropic-ai/sdk",
      "@google/genai",
      "@ai-sdk/openai",
      "@perplexity-ai/perplexity_ai",
    ])
      expect(LLM_SDK.test(name), name).toBe(true);
    expect(LLM_SDK.test("openai/gpt-5.6-sol")).toBe(false);
  });
});
