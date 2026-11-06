// The target's ENABLE_CONNECTIONS state from GET /api/connections/google/start (no params, no redirects).
// That route checks the flag itself, separately from the proxy that gates the pages. 404 is off; on, it
// answers 400 (missing params) or 503 (no site origin). Anything else is a broken probe (preview protection,
// a crash, a redirect), so it throws and the test fails instead of skipping.
export function connectionsFlag(status: number): "on" | "off" {
  if (status === 404) return "off";
  if (status === 400 || status === 503) return "on";
  throw new Error(`connections flag probe: unexpected status ${status} from /api/connections/google/start`);
}
