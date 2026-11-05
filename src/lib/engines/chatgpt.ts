import { llmScraper } from "./llm-scraper";

export const chatgpt = llmScraper("chat_gpt", { force_web_search: true });
