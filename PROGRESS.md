# PROGRESS

## Step 0: Set up the project (in progress)
Changed
- Created private repo jeun27/rank1.us. Next.js 16.4.5 app scaffolded with TypeScript strict, Tailwind v4, ESLint, pnpm. Vitest + Testing Library + Playwright + axe added.
- CLAUDE.md, the five .claude/agents files, TASKS.md, PROGRESS.md, HANDOFF.md, .env.example.

Blocked
- Items 4 to 7 wait on build pack sections 4, 5 and 6 (UI tokens, copy, schema, integrations, AEO). Tokens and copy are not invented.

Doc differences
- Next.js 16 ships its own AGENTS.md telling agents to read node_modules/next/dist/docs before writing code. Kept as is.
- Tailwind v4 has no tailwind.config.js by default. The theme comes from an @theme block in globals.css generated from src/styles/tokens.ts.
- CLAUDE.md says "commit after every green step". Jeun's PR rules say never push to main. Each step is committed on its own branch (step-N-...) and merged through a PR.
