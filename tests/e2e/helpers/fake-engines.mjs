// Local stand-in for DataForSEO and Perplexity in e2e (DATAFORSEO_API_URL / PERPLEXITY_API_URL point here).
// Answers with the committed fixtures; never calls the real APIs.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const fx = (p) => readFileSync(join(process.cwd(), "tests", "fixtures", "engines", p), "utf8");
const ROUTES = {
  "/v3/ai_optimization/chat_gpt/llm_scraper/live/advanced": "chatgpt/synthetic-live-advanced.json",
  "/v3/ai_optimization/gemini/llm_scraper/live/advanced": "gemini/docs-live-advanced.json",
  "/v3/serp/google/organic/live/advanced": "google_aio/synthetic-organic-live-advanced.json",
  "/perplexity": "perplexity/synthetic-restaurant-web-search.json",
};
const port = Number(process.env.FAKE_ENGINES_PORT ?? 4599);

createServer((req, res) => {
  if (req.url === "/health") return res.end("ok");
  const file = ROUTES[req.url ?? ""];
  if (req.method !== "POST" || !file) return res.writeHead(404).end();
  req.resume();
  req.on("end", () => res.writeHead(200, { "content-type": "application/json" }).end(fx(file)));
}).listen(port, "127.0.0.1");
