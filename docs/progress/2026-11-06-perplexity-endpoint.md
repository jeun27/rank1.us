# Perplexity endpoint check (data-pipeline, branch docs/perplexity-endpoint)

- Lead asked (2026-11-06) whether our Perplexity path is deprecated. Perplexity's Agent API reference (https://docs.perplexity.ai/api-reference/agent-post) documents POST https://api.perplexity.ai/v1/agent. user_location sits inside the web_search tool, the answer is output[] message → content[].text, and sources are output[] search_results → results[]. The page lists no alias and no deprecation note.
- src/lib/engines/perplexity.ts already calls /v1/agent with that request shape (since #16; tests/unit/engines/adapters.test.ts asserts the URL). Only docs/INTEGRATIONS.md still said /agent/responses, so this PR fixes that row. No code change.
