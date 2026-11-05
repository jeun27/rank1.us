# Engine fixtures

Files named `docs-*` are the example responses from the official docs, copied unedited (re-indented only). Files named `synthetic-*` are invented, say so in `_synthetic`, and use only "Example …" brands and example.test URLs.

| File | Source | Fetched |
|---|---|---|
| chatgpt/docs-live-advanced.json | https://docs.dataforseo.com/v3/ai_optimization/chat_gpt/llm_scraper/live/advanced/ (response example) | 2026-11-05 |
| gemini/docs-live-advanced.json | https://docs.dataforseo.com/v3/ai_optimization/gemini/llm_scraper/live/advanced/ (response example) | 2026-11-05 |
| google_aio/docs-organic-live-advanced.json | https://docs.dataforseo.com/v3/serp/google/organic/live/advanced/ (response example, includes an ai_overview item) | 2026-11-05 |
| google_aio/synthetic-no-overview.json | synthetic: organic response with no ai_overview item | 2026-11-05 |
| dataforseo/synthetic-task-error-40501.json | synthetic: task status_code 40501, from https://docs.dataforseo.com/v3/appendix/errors/ | 2026-11-05 |
| dataforseo/synthetic-status-40100.json | synthetic: top-level status_code 40100, from https://docs.dataforseo.com/v3/appendix/errors/ | 2026-11-05 |
| perplexity/docs-quickstart-basic.json | https://docs.perplexity.ai/docs/agent-api/quickstart.md (first response, no tools) | 2026-11-05 |
| perplexity/docs-quickstart-web-search.json | https://docs.perplexity.ai/docs/agent-api/quickstart.md (web_search response) | 2026-11-05 |
| perplexity/docs-web-search-response-shape.json | https://docs.perplexity.ai/docs/agent-api/tools/web-search.md ("Response Shape") | 2026-11-05 |
| perplexity/synthetic-restaurant-web-search.json | synthetic: two search_results items, one repeated link | 2026-11-05 |
