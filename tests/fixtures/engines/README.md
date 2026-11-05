# Engine fixtures

Files named `docs-*` are the example responses from the official docs, copied unedited (re-indented only). Files named `synthetic-*` are invented, say so in `_synthetic`, and use only "Example …" brands and example.test URLs. The two "structure from" files keep the docs example's exact JSON shape, field names, numbers and structural values (types, paths, dates); every other string is replaced and phone/address fields are null. The public repo holds no real local businesses, people, phones or emails.

| File | Source | Fetched |
|---|---|---|
| chatgpt/synthetic-live-advanced.json | synthetic, structure from https://docs.dataforseo.com/v3/ai_optimization/chat_gpt/llm_scraper/live/advanced/ (the docs example names real cafés with phones and addresses) | 2026-11-05 |
| gemini/docs-live-advanced.json | https://docs.dataforseo.com/v3/ai_optimization/gemini/llm_scraper/live/advanced/ (response example) | 2026-11-05 |
| google_aio/synthetic-organic-live-advanced.json | synthetic, structure from https://docs.dataforseo.com/v3/serp/google/organic/live/advanced/ (the docs example has real local businesses, hotels, reviews and jobs; its ai_overview item keeps 2 references) | 2026-11-05 |
| google_aio/synthetic-no-overview.json | synthetic: organic response with no ai_overview item | 2026-11-05 |
| dataforseo/synthetic-task-error-40501.json | synthetic: task status_code 40501, from https://docs.dataforseo.com/v3/appendix/errors/ | 2026-11-05 |
| dataforseo/synthetic-status-40100.json | synthetic: top-level status_code 40100, from https://docs.dataforseo.com/v3/appendix/errors/ | 2026-11-05 |
| perplexity/docs-quickstart-basic.json | https://docs.perplexity.ai/docs/agent-api/quickstart.md (first response, no tools) | 2026-11-05 |
| perplexity/docs-quickstart-web-search.json | https://docs.perplexity.ai/docs/agent-api/quickstart.md (web_search response) | 2026-11-05 |
| perplexity/docs-web-search-response-shape.json | https://docs.perplexity.ai/docs/agent-api/tools/web-search.md ("Response Shape") | 2026-11-05 |
| perplexity/synthetic-restaurant-web-search.json | synthetic: two search_results items, one repeated link | 2026-11-05 |
| maps/synthetic-maps-live-advanced.json | synthetic, structure from https://docs.dataforseo.com/v3/serp/google/maps/live/advanced/ (the docs example names real places with addresses) | 2026-11-05 |
| maps/synthetic-irvine-ramen.json | synthetic: 7 Example ramen places in Maps order plus one item with cid null, item shape from the file above | 2026-11-05 |
