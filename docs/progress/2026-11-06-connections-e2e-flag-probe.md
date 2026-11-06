## Connections e2e: the flag-off test reads the target's flag (frontend)

- QA: tests/e2e/connections.spec.ts "ENABLE_CONNECTIONS off … 404" failed on every Preview, where the flag is on, because the skip read the runner's env.
- Now the skip probes the deployment: GET /api/connections/google/start (no params). 404 means off, so the test runs. 400/503 means on, so it skips. That route checks the flag itself, separately from the proxy that gates the pages, so the probe doesn't decide its own test.
- Checked locally: a flag-on build skips (the old version failed), and a flag-off build runs and passes.
- Note for backend: both OAuth routes build as static (○) when the flag is off at build time, so their 404 is frozen into the build. That's harmless on Vercel, where changing an env var means a redeploy, but the flag is effectively build-time for those routes.
